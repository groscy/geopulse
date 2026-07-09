"""fx-worker — FX-vs-USD rates (capability: macro-ingestion).

Uses open.er-api.com (keyless). The change specifies exchangerate.host, but that
provider now requires an API key; open.er-api.com is the keyless equivalent.
Writes `fx_usd` observations (units of local currency per USD) per country.
~15-min cadence; own scheduler; graceful degradation.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.models import Observation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("fx-worker")

bucket = TokenBucket(rate_per_sec=1.0, capacity=2)
_conn = None


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping FX cycle")
        return
    faults.check("er-api")  # M4 fault-injection seam (test-only)

    with httpx.Client() as client:
        r = client.get(config.FX_BASE, timeout=20)
        r.raise_for_status()
        data = r.json()
    if data.get("result") != "success" or "rates" not in data:
        log.warning("FX provider returned no rates: %s", data.get("result"))
        return

    ts = datetime.now(timezone.utc)
    rates = data["rates"]
    obs = []
    for currency, countries in config.FX_CURRENCY_COUNTRIES.items():
        rate = rates.get(currency)
        if rate is None:
            continue
        for iso3 in countries:
            obs.append(Observation(iso3, "fx_usd", float(rate), ts, "er-api", 1.0))
    n = db.upsert_observations(_conn, obs)
    log.info("wrote %d fx_usd observations across %d countries", n, len({o.country for o in obs}))


if __name__ == "__main__":
    run_periodic("fx", config.FX_INTERVAL, cycle)
