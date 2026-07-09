"""macro-worker — macroeconomic indicators via the World Bank API (keyless).

Ingests annual CPI, GDP growth, and central-government debt/GDP for a broad
country set, normalized to canonical `macro_*` metrics (capability: macro-ingestion).
Daily cadence, slow-cadence tau. Own scheduler; graceful per-indicator degradation.

Note: the change also lists Eurostat/FRED/OECD/IMF as enrichment providers; World
Bank alone covers the canonical CPI/GDP/debt metrics keylessly and is implemented
here. The others are future enrichment (FRED needs a key).
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.models import Observation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("macro-worker")

WB = "https://api.worldbank.org/v2"
bucket = TokenBucket(rate_per_sec=2.0, capacity=3)
_conn = None


def _fetch_indicator(client: httpx.Client, metric: str, wb_code: str) -> list[Observation]:
    faults.check("worldbank")  # M4 fault-injection seam (test-only)
    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping %s", metric)
        return []
    codes = ";".join(config.MACRO_COUNTRIES)
    url = f"{WB}/country/{codes}/indicator/{wb_code}"
    params = {"format": "json", "per_page": "20000",
              "date": f"{config.MACRO_HISTORY_FROM}:{datetime.now(timezone.utc).year}"}
    r = client.get(url, params=params, timeout=40)
    r.raise_for_status()
    payload = r.json()
    if not isinstance(payload, list) or len(payload) < 2 or not payload[1]:
        log.warning("no data for %s (%s)", metric, wb_code)
        return []
    obs = []
    for row in payload[1]:
        iso3 = row.get("countryiso3code")
        val = row.get("value")
        year = row.get("date")
        if not iso3 or val is None or not year:
            continue
        try:
            ts = datetime(int(year), 12, 31, tzinfo=timezone.utc)
            obs.append(Observation(iso3, metric, float(val), ts, "worldbank", 1.0))
        except (ValueError, TypeError):
            continue
    return obs


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    total = 0
    with httpx.Client() as client:
        for metric, wb_code in config.WB_INDICATORS.items():
            try:
                obs = _fetch_indicator(client, metric, wb_code)
            except Exception as exc:  # noqa: BLE001 - one bad indicator must not stop the rest
                log.warning("fetch failed for %s: %s", metric, exc)
                continue
            n = db.upsert_observations(_conn, obs)
            total += n
            countries = len({o.country for o in obs})
            log.info("%s: wrote %d observations across %d countries", metric, n, countries)
    log.info("macro cycle done: %d observations", total)


if __name__ == "__main__":
    run_periodic("macro", config.MACRO_INTERVAL, cycle)
