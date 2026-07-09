"""markets-worker — equity market data via Twelve Data (capability: data-ingestion).

Twelve Data's free tier returns daily HISTORY, which seeds the 90d z-score
baselines so the globe shows real states on first run. Symbols are country-equity
ETF proxies (see config.INDEX_SYMBOLS). metric='equity_index'. Own scheduler;
per-provider token bucket; graceful per-symbol degradation.

Requires TWELVE_DATA_KEY. Without it the worker idles (no bad writes).
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.models import Observation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("markets-worker")

BASE = "https://api.twelvedata.com/time_series"
# free tier: 8 requests/min. capacity=1 strictly paces ~1 req / 8.5s (<=7/min)
# so a cold start never bursts past the per-minute quota (NFR-3).
bucket = TokenBucket(rate_per_sec=7 / 60, capacity=1)
_conn = None


def _fetch_series(client: httpx.Client, symbol: str) -> list[dict] | None:
    faults.check("twelvedata")  # M4 fault-injection seam (test-only)
    if not bucket.take(max_wait=30):
        log.warning("rate limit: skipping %s this cycle", symbol)
        return None
    params = {
        "symbol": symbol,
        "interval": "1day",
        "outputsize": str(config.MARKETS_BACKFILL_DAYS),
        "apikey": config.TWELVE_DATA_KEY,
        "format": "JSON",
    }
    r = client.get(BASE, params=params, timeout=30)
    data = r.json()
    if isinstance(data, dict) and data.get("status") == "error":
        log.warning("provider error for %s: %s", symbol, data.get("message"))
        return None
    values = data.get("values") if isinstance(data, dict) else None
    if not values:
        log.warning("no values for %s", symbol)
        return None
    return values


def cycle() -> None:
    global _conn
    if not config.TWELVE_DATA_KEY:
        log.warning("TWELVE_DATA_KEY not set — markets-worker idle. Set it in .env "
                    "and restart this service to ingest.")
        return
    if _conn is None or _conn.closed:
        _conn = db.connect()

    total = 0
    with httpx.Client() as client:
        for entry in config.INDEX_SYMBOLS:
            iso3, symbol = entry["iso3"], entry["symbol"]
            try:
                values = _fetch_series(client, symbol)
            except Exception as exc:  # noqa: BLE001 - one bad symbol must not stop the rest
                log.warning("fetch failed for %s (%s): %s", iso3, symbol, exc)
                continue
            if not values:
                continue
            obs = []
            for v in values:
                try:
                    dt = datetime.strptime(v["datetime"][:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    close = float(v["close"])
                except (KeyError, ValueError):
                    continue
                obs.append(Observation(iso3, "equity_index", close, dt, "twelvedata", 1.0))
            n = db.upsert_observations(_conn, obs)
            total += n
            log.info("%s (%s): wrote %d observations", iso3, symbol, n)
    log.info("markets cycle done: %d observations across %d symbols", total, len(config.INDEX_SYMBOLS))


if __name__ == "__main__":
    run_periodic("markets", config.MARKETS_INTERVAL, cycle)
