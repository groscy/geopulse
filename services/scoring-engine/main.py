"""scoring-engine — z-scores -> weighted domain rollups -> hysteresis -> composite + incidents.

M1: per-metric self-relative z-scores, worst-of composite, auditable inputs.
M2: hysteresis (NFR-4) + incident lifecycle.
M3: multi-metric weighted domain rollups — Economy (macro CPI/GDP/debt) and FX
    added to Markets — with per-metric staleness discounting.
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone

from psycopg.types.json import Json

from common import config, db, hysteresis
from common.log import get_logger
from common.scheduler import run_periodic

log = get_logger("scoring-engine")

STATE_RANK = {"operational": 0, "degraded": 1, "disrupted": 2}
NAMES = {
    "USA": "United States", "JPN": "Japan", "DEU": "Germany", "FRA": "France",
    "CHE": "Switzerland", "GBR": "United Kingdom", "CHN": "China", "BRA": "Brazil",
    "ARG": "Argentina", "IND": "India", "KOR": "South Korea", "CAN": "Canada",
    "RUS": "Russia", "IRN": "Iran", "UKR": "Ukraine", "AUS": "Australia", "NZL": "New Zealand",
    "ITA": "Italy", "ESP": "Spain", "TUR": "Turkey", "MEX": "Mexico", "ZAF": "South Africa",
}
_conn = None


def _clamp(z: float) -> float:
    return max(-config.CLAMP_Z, min(config.CLAMP_Z, z))


def _state_from_z(absz: float) -> str:
    if absz < 1:
        return "operational"
    if absz < 2:
        return "degraded"
    return "disrupted"


def _series_z(series: list[tuple[float, datetime]], metric: str, now: datetime) -> dict:
    """z-score result for an ordered (value, ts) series. `stale` if too few/aged."""
    minpts = config.MIN_BASELINE_BY_METRIC.get(metric, config.MIN_BASELINE_POINTS)
    values = [v for v, _ in series]
    latest, latest_ts = series[-1]
    if len(series) < minpts:
        return {"stale": True, "metric": metric, "n": len(series), "latest": latest, "series": values[-40:]}
    mean = statistics.fmean(values)
    std = statistics.pstdev(values)
    z = 0.0 if std == 0 else _clamp((latest - mean) / std)
    age_s = (now - latest_ts).total_seconds()
    coverage = math.exp(-age_s / config.TAU_SECONDS.get(metric, config.DEFAULT_TAU))
    return {"metric": metric, "z": round(z, 3), "mean": round(mean, 4), "std": round(std, 4),
            "latest": latest, "n": len(values), "age_min": round(age_s / 60),
            "coverage": round(coverage, 3), "ts": latest_ts.isoformat(), "series": values[-40:]}


HIGH_FREQ = {"equity_index", "fx_usd"}


def baseline_series(country: str, metric: str, now: datetime) -> list[tuple[float, datetime]]:
    """Baseline series for a metric. High-frequency metrics read older buckets from
    the `observation_daily` continuous aggregate + the most-recent window from raw
    (M4, task 3.2); everything falls back to raw."""
    lookback = config.BASELINE_DAYS_BY_METRIC.get(metric, config.BASELINE_DAYS)
    start = now - timedelta(days=lookback)
    if metric in HIGH_FREQ:
        recent = now - timedelta(days=2)
        agg: list = []
        try:
            agg = db.query(
                _conn,
                "SELECT avg_value, bucket FROM observation_daily WHERE country=%s AND metric=%s "
                "AND bucket > %s AND bucket <= %s ORDER BY bucket",
                (country, metric, start, recent),
            )
        except Exception:  # noqa: BLE001 - aggregate may not exist yet; fall back to raw
            agg = []
        raw = db.query(
            _conn,
            "SELECT value, ts FROM observation WHERE country=%s AND metric=%s AND ts > %s ORDER BY ts",
            (country, metric, recent),
        )
        series = [(float(v), t) for v, t in agg] + [(float(v), t) for v, t in raw]
        if len(series) >= config.MIN_BASELINE_POINTS:
            return series
    rows = db.query(
        _conn,
        "SELECT value, ts FROM observation WHERE country=%s AND metric=%s AND ts > %s ORDER BY ts",
        (country, metric, start),
    )
    return [(float(v), t) for v, t in rows]


def metric_z(country: str, metric: str, now: datetime) -> dict | None:
    series = baseline_series(country, metric, now)
    if not series:
        return None
    return _series_z(series, metric, now)


def score_domain(country: str, domain: str, now: datetime) -> dict | None:
    """Staleness-discounted weighted rollup of the domain's metrics."""
    weights = config.WEIGHTS[domain]
    total_w = sum(weights.values())
    eff_w = weighted_z = 0.0
    per_metric: dict[str, str] = {}
    driver: dict | None = None
    driver_contrib = -1.0
    for metric, w in weights.items():
        mz = metric_z(country, metric, now)
        if mz is None:
            continue  # no data for this metric at all
        if mz.get("stale"):
            per_metric[metric] = "stale"
            continue
        cov = mz["coverage"]
        e = w * cov
        eff_w += e
        weighted_z += e * mz["z"]
        per_metric[metric] = _state_from_z(abs(mz["z"]))
        contrib = e * abs(mz["z"])
        if contrib > driver_contrib:
            driver_contrib, driver = contrib, mz
    if not per_metric:
        return None
    coverage = eff_w / total_w if total_w else 0.0
    if eff_w == 0 or coverage < config.COVERAGE_MIN:
        return {"state": "stale", "value": None, "z": 0.0, "domain": domain,
                "coverage": round(coverage, 3), "per_metric": per_metric, "driver": driver}
    domain_z = weighted_z / eff_w
    return {"state": _state_from_z(abs(domain_z)), "value": round(domain_z, 3), "z": round(domain_z, 3),
            "domain": domain, "coverage": round(coverage, 3), "per_metric": per_metric, "driver": driver}


def score_relations(country: str, now: datetime) -> dict | None:
    rows = db.query(
        _conn,
        "SELECT ts, avg(value) FROM dyad_observation WHERE country_a=%s AND metric='gdelt_tone' "
        "AND ts > %s GROUP BY ts ORDER BY ts",
        (country, now - timedelta(days=config.BASELINE_DAYS)),
    )
    if not rows:
        return None
    mz = _series_z([(float(v), t) for t, v in rows], "gdelt_tone", now)
    if mz.get("stale"):
        return {"state": "stale", "value": None, "z": 0.0, "domain": "relations",
                "coverage": 0.0, "per_metric": {"gdelt_tone": "stale"}, "driver": mz}
    st = _state_from_z(abs(mz["z"]))
    return {"state": st, "value": mz["z"], "z": mz["z"], "domain": "relations",
            "coverage": mz["coverage"], "per_metric": {"gdelt_tone": st}, "driver": mz}


# ---- hysteresis (NFR-4) — pure logic in common.hysteresis (unit-tested) ----
def apply_hysteresis(country: str, domain: str, res: dict) -> str:
    row = db.query(
        _conn,
        "SELECT committed_state, candidate_state, candidate_count FROM domain_state "
        "WHERE country=%s AND domain=%s",
        (country, domain),
    )
    prev_committed = row[0][0] if row else None
    desired = "stale" if res["state"] == "stale" else hysteresis.desired_state(prev_committed, abs(res["z"]))

    if not row:
        committed, candidate, count = desired, desired, 0
    else:
        prev_state, prev_candidate, prev_count = row[0]
        committed, candidate, count = hysteresis.commit_step(
            prev_state, prev_candidate or prev_state, prev_count, desired, config.HYSTERESIS_N)

    with _conn.cursor() as cur:
        cur.execute(
            "INSERT INTO domain_state (country, domain, committed_state, candidate_state, candidate_count, updated_at) "
            "VALUES (%s,%s,%s,%s,%s, now()) "
            "ON CONFLICT (country, domain) DO UPDATE SET committed_state=EXCLUDED.committed_state, "
            "candidate_state=EXCLUDED.candidate_state, candidate_count=EXCLUDED.candidate_count, updated_at=now()",
            (country, domain, committed, candidate, count),
        )
    return committed


def composite_of(committed: dict[str, str]) -> tuple[str, list[str]]:
    non_stale = {d: s for d, s in committed.items() if s in STATE_RANK}
    if non_stale:
        worst = max(non_stale, key=lambda d: STATE_RANK[non_stale[d]])
        return non_stale[worst], [worst]
    return "stale", list(committed.keys())


def incident_lifecycle(country: str, committed: dict[str, str], raw: dict[str, dict]) -> None:
    name = NAMES.get(country, country)
    for domain, state in committed.items():
        dedup = f"{country}:{domain}"
        if state in ("degraded", "disrupted"):
            drv = raw[domain].get("driver") or {}
            thr_z = config.ENTER_DISRUPTED if state == "disrupted" else config.ENTER_DEGRADED
            detail = {
                "domain": domain, "metric": drv.get("metric"), "z": drv.get("z"),
                "mean": drv.get("mean"), "std": drv.get("std"), "latest": drv.get("latest"),
                "series": drv.get("series", []), "threshold_z": thr_z, "state": state,
                "country": country, "age_min": drv.get("age_min"),
            }
            with _conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO incident (dedup_key, severity, countries, metric, threshold, title, detail) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (dedup_key) WHERE resolved_at IS NULL "
                    "DO UPDATE SET severity=EXCLUDED.severity, detail=EXCLUDED.detail, "
                    "threshold=EXCLUDED.threshold, title=EXCLUDED.title",
                    (dedup, state, [country], drv.get("metric"), f"|z| ≥ {thr_z:.1f}",
                     f"{name} · {domain} {state}", Json(detail)),
                )
        else:
            with _conn.cursor() as cur:
                cur.execute("UPDATE incident SET resolved_at=now() WHERE dedup_key=%s AND resolved_at IS NULL", (dedup,))


def cycle() -> None:
    global _conn
    if _conn is None or _conn.closed:
        _conn = db.connect()
    now = datetime.now(timezone.utc)

    obs_countries = {r[0].strip() for r in db.query(_conn, "SELECT DISTINCT country FROM observation")}
    rel_countries = {r[0].strip() for r in db.query(_conn, "SELECT DISTINCT country_a FROM dyad_observation WHERE metric='gdelt_tone'")}
    countries = sorted(obs_countries | rel_countries)

    rows_written = 0
    for country in countries:
        raw: dict[str, dict] = {}
        for domain in ("markets", "economy"):
            r = score_domain(country, domain, now)
            if r:
                raw[domain] = r
        rel = score_relations(country, now)
        if rel:
            raw["relations"] = rel
        if not raw:
            continue

        committed = {d: apply_hysteresis(country, d, res) for d, res in raw.items()}
        comp_state, worst = composite_of(committed)

        score_rows = []
        for d, res in raw.items():
            slim = {"z": res.get("z"), "value": res.get("value"), "coverage": res.get("coverage"),
                    "per_metric": res.get("per_metric")}
            score_rows.append((country, d, res.get("value"), committed[d], now, Json(slim)))
        score_rows.append((country, "composite", None, comp_state, now, Json({"worst": worst, "domains": committed})))
        with _conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO score (country, domain, value, state, computed_at, inputs) "
                "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                score_rows,
            )
        rows_written += len(score_rows)
        incident_lifecycle(country, committed, raw)

    open_inc = db.query(_conn, "SELECT count(*) FROM incident WHERE resolved_at IS NULL")[0][0]
    log.info("scored %d countries (%d rows); open incidents=%d", len(countries), rows_written, open_inc)


if __name__ == "__main__":
    run_periodic("scoring", config.SCORING_INTERVAL, cycle)
