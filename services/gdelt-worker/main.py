"""gdelt-worker — GDELT 2.0 events -> country-dyad tone (capability: data-ingestion).

Fetches the latest 15-min GDELT export, aggregates AvgTone by (Actor1, Actor2)
ISO-3 pair, and writes `gdelt_tone` dyad observations for pairs meeting the
minimum-event count (R-2). Own scheduler; graceful on any upstream failure.
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime, timezone

import httpx

from common import config, db, faults
from common.log import get_logger
from common.models import DyadObservation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("gdelt-worker")

LASTUPDATE = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
# GDELT 2.0 event column indices
COL_A1_COUNTRY = 7
COL_A2_COUNTRY = 17
COL_AVGTONE = 34

bucket = TokenBucket(rate_per_sec=1.0, capacity=3)
_conn = None


def _iso3(code: str) -> bool:
    return len(code) == 3 and code.isalpha() and code.isupper()


def _latest_export_url(client: httpx.Client) -> str | None:
    r = client.get(LASTUPDATE, timeout=20)
    r.raise_for_status()
    for line in r.text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[2].endswith("export.CSV.zip"):
            return parts[2]
    return None


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()

    if not bucket.take(max_wait=20):
        log.warning("rate limit: skipping GDELT cycle")
        return
    faults.check("gdelt")  # M4 fault-injection seam (test-only)

    with httpx.Client(follow_redirects=True) as client:
        url = _latest_export_url(client)
        if not url:
            log.warning("no export URL found in lastupdate")
            return
        log.info("fetching %s", url)
        resp = client.get(url, timeout=60)
        resp.raise_for_status()
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        raw = zf.read(zf.namelist()[0]).decode("utf-8", "replace")

    tone_sum: dict[tuple[str, str], float] = defaultdict(float)
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for row in csv.reader(io.StringIO(raw), delimiter="\t"):
        if len(row) <= COL_AVGTONE:
            continue
        a, b = row[COL_A1_COUNTRY], row[COL_A2_COUNTRY]
        if not (_iso3(a) and _iso3(b)) or a == b:
            continue
        try:
            tone = float(row[COL_AVGTONE])
        except ValueError:
            continue
        tone_sum[(a, b)] += tone
        counts[(a, b)] += 1

    ts = datetime.now(timezone.utc)
    obs = [
        DyadObservation(a, b, "gdelt_tone", tone_sum[(a, b)] / n, ts, "gdelt")
        for (a, b), n in counts.items()
        if n >= config.GDELT_MIN_EVENTS
    ]
    written = db.upsert_dyads(_conn, obs)
    log.info(
        "wrote %d dyad tone obs (of %d candidate pairs, min_events=%d)",
        written, len(counts), config.GDELT_MIN_EVENTS,
    )


if __name__ == "__main__":
    run_periodic("gdelt", config.GDELT_INTERVAL, cycle)
