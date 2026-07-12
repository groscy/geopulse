"""weather-worker — surface temperature, precipitation, wind per country (capability: data-ingestion).

Uses Open-Meteo (keyless). Samples current conditions at each tracked country's
representative point (capital) in a single batched request, and writes
`weather_temp` (°C), `weather_precip` (mm), and `weather_wind` (km/h) point
observations. The scoring engine z-scores each against the country's own baseline,
turning raw values into self-relative anomalies (temp two-sided; precip/wind
one-sided flood/wind hazards). Cloud cover is deferred to the Phase 3 field shell.
Hourly cadence; own scheduler; graceful degradation.
"""
from __future__ import annotations

import statistics
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.models import Observation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("weather-worker")

bucket = TokenBucket(rate_per_sec=1.0, capacity=2)
_conn = None

# Open-Meteo archive `daily=` field -> canonical metric, for climatology normals.
_ARCHIVE_FIELDS = (("temperature_2m_mean", "weather_temp"),
                   ("precipitation_sum", "weather_precip"),
                   ("wind_speed_10m_max", "weather_wind"))


def backfill_normals() -> None:
    """One-time, gentle backfill of day-of-year climatology normals (mean, sd) from
    multi-year Open-Meteo archive data, for countries that don't have them yet. A few
    countries per cycle; each country's fetch is isolated (a failure retries next
    cycle). Removes the scoring engine's seasonal drift and lets facets warm up fast."""
    have = db.countries_with_normals(_conn, "weather_temp")
    missing = [c for c in config.WEATHER_POINTS if c not in have]
    if not missing:
        return
    today = datetime.now(timezone.utc).date()
    end = today - timedelta(days=5)                       # archive lags a few days
    start = end.replace(year=end.year - config.CLIMO_YEARS)
    with httpx.Client() as client:
        for n, iso3 in enumerate(missing[:config.CLIMO_BACKFILL_PER_CYCLE]):
            if n:
                time.sleep(config.CLIMO_BACKFILL_SLEEP)  # pace requests to avoid 429
            lat, lon = config.WEATHER_POINTS[iso3]
            try:
                r = client.get(config.OPEN_METEO_ARCHIVE, params={
                    "latitude": lat, "longitude": lon,
                    "start_date": start.isoformat(), "end_date": end.isoformat(),
                    "daily": ",".join(f for f, _m in _ARCHIVE_FIELDS), "timezone": "UTC",
                }, timeout=60)
                r.raise_for_status()
                daily = (r.json() or {}).get("daily") or {}
                times = daily.get("time") or []
                buckets: dict[str, dict[int, list[float]]] = {m: defaultdict(list) for _f, m in _ARCHIVE_FIELDS}
                for i, t in enumerate(times):
                    doy = date.fromisoformat(t).timetuple().tm_yday
                    for field, metric in _ARCHIVE_FIELDS:
                        vals = daily.get(field) or []
                        v = vals[i] if i < len(vals) else None
                        if v is not None:
                            buckets[metric][doy].append(float(v))
                rows = [(iso3, m, doy, statistics.fmean(vs), statistics.pstdev(vs))
                        for m, byd in buckets.items() for doy, vs in byd.items() if len(vs) >= 2]
                wrote = db.upsert_normals(_conn, rows)
                log.info("backfilled %d climatology normals for %s", wrote, iso3)
            except Exception as exc:  # noqa: BLE001 - isolate per country; retry next cycle
                log.warning("normals backfill for %s failed: %s", iso3, exc)


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping weather cycle")
        return
    faults.check("open-meteo")  # M4 fault-injection seam (test-only)

    points = list(config.WEATHER_POINTS.items())
    if not points:
        return
    lats = ",".join(f"{lat:g}" for _, (lat, _lon) in points)
    lons = ",".join(f"{lon:g}" for _, (_lat, lon) in points)

    with httpx.Client() as client:
        r = client.get(
            config.OPEN_METEO_BASE,
            params={
                "latitude": lats,
                "longitude": lons,
                # one batched call, three point scalars — no cloud (deferred to Phase 3).
                "current": "temperature_2m,precipitation,wind_speed_10m",
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()

    # Open-Meteo returns a JSON array (one object per point) for a multi-point
    # request, or a single object for one point; normalize to a list in input order.
    results = data if isinstance(data, list) else [data]
    if len(results) != len(points):
        log.warning("open-meteo returned %d results for %d points; skipping", len(results), len(points))
        return

    # Open-Meteo current field -> canonical metric (temp °C, precip mm, wind km/h).
    fields = (("temperature_2m", "weather_temp"), ("precipitation", "weather_precip"),
              ("wind_speed_10m", "weather_wind"))
    ts = datetime.now(timezone.utc)
    obs = []
    counts = {m: 0 for _f, m in fields}
    for (iso3, _coords), res in zip(points, results):
        current = res.get("current") or {}
        # emit each present field; a country missing an individual field simply
        # skips that metric (partial fields tolerated — never fail the batch).
        for field, metric in fields:
            val = current.get(field)
            if val is None:
                continue
            obs.append(Observation(iso3, metric, float(val), ts, "open-meteo", 1.0))
            counts[metric] += 1
    n = db.upsert_observations(_conn, obs)
    log.info("wrote %d weather observations (temp=%d precip=%d wind=%d)",
             n, counts["weather_temp"], counts["weather_precip"], counts["weather_wind"])

    # after the live write, gently backfill any missing climatology normals (one-time).
    try:
        backfill_normals()
    except Exception as exc:  # noqa: BLE001 - never let backfill break the obs cycle
        log.warning("normals backfill skipped: %s", exc)


if __name__ == "__main__":
    run_periodic("weather", config.WEATHER_INTERVAL, cycle)
