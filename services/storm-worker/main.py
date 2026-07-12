"""storm-worker — live tropical-cyclone tracks + country:storm incidents (capability: storm-tracks).

Fetches active cyclones from NOAA's NHC CurrentStorms feed (keyless, Atlantic + East
Pacific), caches them as ONE blob (feature data — no per-country z-score, never in the
observation/score spine), and maps each storm to the tracked countries it threatens,
opening/resolving `country:storm` incidents in the shared incident table with a spatial
hysteresis buffer. Own scheduler; token-bucketed; graceful degradation.
"""
from __future__ import annotations

import math

import httpx
from psycopg.types.json import Json

from common import config, db, faults
from common.log import get_logger
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("storm-worker")

bucket = TokenBucket(rate_per_sec=1.0, capacity=2)
_conn = None

# NHC classification code -> display word.
_CLASS = {
    "HU": "Hurricane", "TS": "Tropical Storm", "TD": "Tropical Depression",
    "STS": "Severe Tropical Storm", "TY": "Typhoon", "STY": "Super Typhoon",
    "PTC": "Potential Cyclone", "SD": "Subtropical Depression", "SS": "Subtropical Storm",
    "MH": "Major Hurricane",
}


def _category(intensity_kt: float) -> tuple[int, str]:
    """Saffir-Simpson category + label from max sustained wind (kt)."""
    v = intensity_kt
    if v >= 137: return 5, "Cat 5"
    if v >= 113: return 4, "Cat 4"
    if v >= 96:  return 3, "Cat 3"
    if v >= 83:  return 2, "Cat 2"
    if v >= 64:  return 1, "Cat 1"
    if v >= 34:  return 0, "Trop. Storm"
    return 0, "Trop. Depression"


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lat1, lon1), (lat2, lon2) = a, b
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _project_track(lat: float, lon: float, bearing_deg, speed_kt, steps: int = 4, hours: int = 6) -> list[list[float]]:
    """Crude near-term track: project from the position along the movement vector
    (great-circle steps). [lon, lat] points, for proximity + a render polyline."""
    if bearing_deg is None or speed_kt is None or speed_kt <= 0:
        return []
    R = 6371.0
    brg = math.radians(bearing_deg)
    p1, l1 = math.radians(lat), math.radians(lon)
    pts = []
    for k in range(1, steps + 1):
        dr = (speed_kt * 1.852 * hours * k) / R  # kt -> km/h (×1.852) × hours × step
        p2 = math.asin(math.sin(p1) * math.cos(dr) + math.cos(p1) * math.sin(dr) * math.cos(brg))
        l2 = l1 + math.atan2(math.sin(brg) * math.sin(dr) * math.cos(p1),
                             math.cos(dr) - math.sin(p1) * math.sin(p2))
        pts.append([round(math.degrees(l2), 2), round(math.degrees(p2), 2)])
    return pts


def _parse_coord(v, neg: str) -> float | None:
    """Parse an NHC coord string like '20.5N' / '95.5W'; `neg` is the negative hemisphere letter."""
    if not v:
        return None
    s = str(v).strip()
    try:
        num, h = float(s[:-1]), s[-1].upper()
        return -num if h == neg else num
    except (ValueError, IndexError):
        return None


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _parse_storm(s: dict) -> dict | None:
    lat = s.get("latitudeNumeric")
    lon = s.get("longitudeNumeric")
    if lat is None:
        lat = _parse_coord(s.get("latitude"), "S")
    if lon is None:
        lon = _parse_coord(s.get("longitude"), "W")
    if lat is None or lon is None:
        return None
    intensity = _to_float(s.get("intensity")) or 0.0
    cat, label = _category(intensity)
    name = s.get("name") or "Cyclone"
    klass = _CLASS.get((s.get("classification") or "").upper(), "Cyclone")
    track = _project_track(float(lat), float(lon), _to_float(s.get("movementDir")), _to_float(s.get("movementSpeed")))
    return {
        "id": s.get("id") or s.get("binNumber") or name,
        "name": f"{klass} {name}".strip(),
        "basin": s.get("binNumber", ""),
        "lat": round(float(lat), 2), "lon": round(float(lon), 2),
        "category": cat, "categoryLabel": label, "intensityKt": intensity,
        "track": track,
    }


def _rank(sev: str, st: dict) -> tuple:
    """Worst-storm ordering when several threaten one country."""
    return (1 if sev == "disrupted" else 0, st["category"], st["intensityKt"])


def _apply_incidents(open_threat: dict[str, dict], keep: set[str]) -> None:
    """Open/update `country:storm` incidents for threatened countries, and resolve any
    open storm incident whose country is no longer within the resolve buffer."""
    for iso3, info in open_threat.items():
        st, sev = info["storm"], info["severity"]
        detail = {
            "domain": "storm", "storm": st["name"], "category": st["category"],
            "categoryLabel": st["categoryLabel"], "lat": st["lat"], "lon": st["lon"],
            "intensity_kt": st["intensityKt"], "country": iso3, "state": sev,
        }
        with _conn.cursor() as cur:
            cur.execute(
                "INSERT INTO incident (dedup_key, severity, countries, metric, threshold, title, detail) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (dedup_key) WHERE resolved_at IS NULL "
                "DO UPDATE SET severity=EXCLUDED.severity, detail=EXCLUDED.detail, "
                "threshold=EXCLUDED.threshold, title=EXCLUDED.title",
                (f"{iso3}:storm", sev, [iso3], "storm", st["categoryLabel"],
                 f"{iso3} · {st['name']}", Json(detail)),
            )
    for (dedup,) in db.query(_conn, "SELECT dedup_key FROM incident WHERE metric='storm' AND resolved_at IS NULL"):
        if dedup.split(":", 1)[0] not in keep:
            with _conn.cursor() as cur:
                cur.execute("UPDATE incident SET resolved_at=now() WHERE dedup_key=%s AND resolved_at IS NULL", (dedup,))


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping storm cycle")
        return
    faults.check("nhc")  # M4 fault-injection seam (test-only)

    with httpx.Client() as client:
        r = client.get(config.NHC_CURRENT_STORMS, timeout=30)
        r.raise_for_status()
        data = r.json()

    raw = data.get("activeStorms") or [] if isinstance(data, dict) else []
    storms = [st for st in (_parse_storm(s) for s in raw) if st]
    db.upsert_storms(_conn, storms)  # single-blob overwrite — no observation/score rows

    # map storms -> threatened countries: OPEN within STORM_OPEN_KM, KEEP within the
    # larger STORM_RESOLVE_KM (spatial hysteresis so a skirting storm doesn't flap).
    open_threat: dict[str, dict] = {}
    keep: set[str] = set()
    for st in storms:
        sev = "disrupted" if st["category"] >= config.STORM_DISRUPTED_CAT else "degraded"
        pts = [(st["lat"], st["lon"])] + [(p[1], p[0]) for p in st["track"]]
        for iso3, (clat, clon) in config.WEATHER_POINTS.items():
            dmin = min(_haversine_km((clat, clon), sp) for sp in pts)
            if dmin <= config.STORM_RESOLVE_KM:
                keep.add(iso3)
            if dmin <= config.STORM_OPEN_KM:
                cur = open_threat.get(iso3)
                if cur is None or _rank(sev, st) > _rank(cur["severity"], cur["storm"]):
                    open_threat[iso3] = {"severity": sev, "storm": st}

    _apply_incidents(open_threat, keep)
    log.info("cached %d active storms; %d countries threatened", len(storms), len(open_threat))


if __name__ == "__main__":
    run_periodic("storm", config.STORM_INTERVAL, cycle)
