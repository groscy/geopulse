"""weather-field-worker — global atmospheric field grid (capability: weather-field).

Fetches a coarse GLOBAL grid of {cloud%, wind u/v, precipitation} from Open-Meteo
(keyless) on a slow cadence and caches it as ONE blob (overwritten each cycle). Field
data has NO country and NO z-score: it never touches the observation store or scoring
— it is an ambient visualization layer only (the Meteorological overlay's lifted cloud
shell). Own scheduler; token-bucketed; graceful degradation (an outage leaves the last
cached grid in place rather than writing a bad blob).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("weather-field-worker")

bucket = TokenBucket(rate_per_sec=1.0, capacity=2)
_conn = None


def grid_nodes() -> list[tuple[float, float]]:
    """Coarse global (lat, lon) grid over the clamped latitude band (excludes the
    +180 meridian, which duplicates -180)."""
    step = config.WEATHER_FIELD_STEP
    lats = range(config.WEATHER_FIELD_LAT_MIN, config.WEATHER_FIELD_LAT_MAX + 1, step)
    lons = range(-180, 180, step)
    return [(float(la), float(lo)) for la in lats for lo in lons]


def _chunks(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping weather-field cycle")
        return
    faults.check("open-meteo")  # M4 fault-injection seam (test-only)

    nodes = grid_nodes()
    if not nodes:
        return

    # Fetch every chunk first; only cache once the WHOLE grid succeeds, so a
    # mid-cycle failure leaves the last-known blob untouched (graceful degradation).
    # Values accumulate into flat per-channel arrays in row-major node order (lat outer,
    # lon inner) — a packed columnar blob so the finer grid stays cheap over the wire.
    cloud: list = []
    u: list = []
    v: list = []
    precip: list = []
    with httpx.Client() as client:
        for chunk in _chunks(nodes, config.WEATHER_FIELD_BATCH):
            lats = ",".join(f"{la:g}" for la, _lo in chunk)
            lons = ",".join(f"{lo:g}" for _la, lo in chunk)
            r = client.get(
                config.OPEN_METEO_BASE,
                params={
                    "latitude": lats,
                    "longitude": lons,
                    # cloud + wind (speed/dir -> u/v) + precip; no per-country, no temp facet.
                    "current": "cloud_cover,wind_speed_10m,wind_direction_10m,precipitation",
                },
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
            results = data if isinstance(data, list) else [data]
            if len(results) != len(chunk):
                log.warning("open-meteo returned %d results for %d nodes; skipping cycle",
                            len(results), len(chunk))
                return
            for res in results:
                c, wu, wv, p = _node(res.get("current") or {})
                cloud.append(c); u.append(wu); v.append(wv); precip.append(p)

    lats = list(range(config.WEATHER_FIELD_LAT_MIN, config.WEATHER_FIELD_LAT_MAX + 1, config.WEATHER_FIELD_STEP))
    nlon = len(range(-180, 180, config.WEATHER_FIELD_STEP))
    ts = datetime.now(timezone.utc)
    grid = {
        "step": config.WEATHER_FIELD_STEP,
        "latMin": config.WEATHER_FIELD_LAT_MIN,
        "latMax": config.WEATHER_FIELD_LAT_MAX,
        "nlat": len(lats), "nlon": nlon,
        "ts": ts.isoformat(),
        "cloud": cloud, "u": u, "v": v, "precip": precip,
    }
    db.upsert_weather_field(_conn, grid)  # single-blob overwrite — no observation/score/incident
    log.info("cached weather field grid: %d nodes (%dx%d, packed)", len(cloud), len(lats), nlon)


def _node(cur: dict) -> tuple:
    """One grid node -> (cloud%, u, v, precip). Wind speed+direction -> u/v vector
    (meteorological convention: direction is where the wind comes FROM; u east+, v
    north+). Missing fields -> null."""
    cloud = cur.get("cloud_cover")
    spd = cur.get("wind_speed_10m")
    deg = cur.get("wind_direction_10m")
    precip = cur.get("precipitation")
    u = v = None
    if spd is not None and deg is not None:
        rad = math.radians(float(deg))
        u = round(-float(spd) * math.sin(rad), 2)
        v = round(-float(spd) * math.cos(rad), 2)
    return (
        None if cloud is None else round(float(cloud), 1),
        u, v,
        None if precip is None else round(float(precip), 2),
    )


if __name__ == "__main__":
    run_periodic("weather-field", config.WEATHER_FIELD_INTERVAL, cycle)
