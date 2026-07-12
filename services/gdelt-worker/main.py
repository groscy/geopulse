"""gdelt-worker — GDELT 2.0 events -> country-dyad tone + per-country news (capability: data-ingestion).

Fetches the latest 15-min GDELT export and, in one parse pass, (1) aggregates
AvgTone by (Actor1, Actor2) ISO-3 pair into `gdelt_tone` dyad observations for
pairs meeting the minimum-event count (R-2), and (2) aggregates every ISO-3 actor
(Actor1 ∪ Actor2) into article-weighted per-country point observations —
`news_tone`, `news_goldstein`, `news_volume` — gated by a minimum article count.
Own scheduler; graceful on any upstream failure.
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
from common.models import DyadObservation, Observation
from common.ratelimit import TokenBucket
from common.scheduler import run_periodic

log = get_logger("gdelt-worker")

LASTUPDATE = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
# GDELT 2.0 event column indices
COL_A1_COUNTRY = 7
COL_A2_COUNTRY = 17
COL_GOLDSTEIN = 30
COL_NUMARTICLES = 33
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
    # per-country article-weighted accumulators (Actor1 ∪ Actor2, ISO-3)
    c_tone_w: dict[str, float] = defaultdict(float)  # Σ AvgTone·articles
    c_gold_w: dict[str, float] = defaultdict(float)  # Σ GoldsteinScale·articles
    c_vol: dict[str, float] = defaultdict(float)     # Σ articles (weight + volume)
    for row in csv.reader(io.StringIO(raw), delimiter="\t"):
        if len(row) <= COL_AVGTONE:
            continue
        a, b = row[COL_A1_COUNTRY], row[COL_A2_COUNTRY]
        try:
            tone = float(row[COL_AVGTONE])
        except ValueError:
            continue

        # (1) dyad tone — cross-border ISO-3 pairs only; output unchanged (R-2).
        if _iso3(a) and _iso3(b) and a != b:
            tone_sum[(a, b)] += tone
            counts[(a, b)] += 1

        # (2) per-country news signals — any ISO-3 actor, article-weighted. A
        # domestic (a == b) or single-actor event still counts, once, via the set.
        try:
            gold = float(row[COL_GOLDSTEIN])
        except ValueError:
            gold = 0.0
        try:
            articles = float(row[COL_NUMARTICLES])
        except ValueError:
            articles = 0.0
        weight = articles if articles > 0 else 1.0
        for code in {a, b}:
            if not _iso3(code):
                continue
            c_tone_w[code] += tone * weight
            c_gold_w[code] += gold * weight
            c_vol[code] += weight

    ts = datetime.now(timezone.utc)
    obs = [
        DyadObservation(a, b, "gdelt_tone", tone_sum[(a, b)] / n, ts, "gdelt")
        for (a, b), n in counts.items()
        if n >= config.GDELT_MIN_EVENTS
    ]
    written = db.upsert_dyads(_conn, obs)

    # per-country news point observations, gated by a minimum article count.
    news_obs: list[Observation] = []
    for code, vol in c_vol.items():
        if vol < config.GDELT_MIN_COUNTRY_ARTICLES:
            continue
        news_obs.append(Observation(code, "news_tone", c_tone_w[code] / vol, ts, "gdelt"))
        news_obs.append(Observation(code, "news_goldstein", c_gold_w[code] / vol, ts, "gdelt"))
        news_obs.append(Observation(code, "news_volume", vol, ts, "gdelt"))
    news_written = db.upsert_observations(_conn, news_obs)
    log.info(
        "wrote %d dyad tone obs (of %d candidate pairs, min_events=%d); "
        "%d news point obs for %d/%d countries (min_articles=%s)",
        written, len(counts), config.GDELT_MIN_EVENTS,
        news_written, len(news_obs) // 3, len(c_vol), config.GDELT_MIN_COUNTRY_ARTICLES,
    )


if __name__ == "__main__":
    run_periodic("gdelt", config.GDELT_INTERVAL, cycle)
