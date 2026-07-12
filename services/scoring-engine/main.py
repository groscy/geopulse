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


def _dir_mag(z: float, sided: str) -> float:
    """Directional magnitude fed to the four-state mapping and hysteresis.

    `both` -> |z| (either tail escalates, e.g. heat AND cold). `high` -> max(z, 0)
    (only the positive/hazard tail escalates; a negative/non-hazard z clamps to 0
    -> operational). `low` -> max(-z, 0). Baking directionality into this magnitude
    keeps the downstream state, hysteresis, and incident gating unchanged."""
    if sided == "high":
        return max(z, 0.0)
    if sided == "low":
        return max(-z, 0.0)
    return abs(z)


# per-metric transform applied ONLY inside the z computation (raw values stay
# stored/displayed). Maps the config string to the actual function.
_TRANSFORMS = {"log1p": lambda v: math.log1p(max(0.0, v))}


def _doy(now: datetime) -> int:
    return now.timetuple().tm_yday


def _window_doys(doy: int, half: int) -> list[int]:
    """Days-of-year within ±half of `doy` (1..366, year-wrap aware)."""
    return sorted({((doy - 1 + k) % 366) + 1 for k in range(-half, half + 1)})


def _last_doys(doy: int, win: int) -> list[int]:
    """The last `win` days-of-year ending at `doy` (the accumulation window)."""
    return [((doy - 1 - k) % 366) + 1 for k in range(win)]


def _percentile_z(latest: float, values: list[float]) -> float:
    """Empirical-CDF percentile of `latest` within `values`, mapped through the normal
    quantile so the standard z-bands still apply (robust to skew / zero-inflation)."""
    n = len(values)
    below = sum(1 for v in values if v < latest)
    equal = sum(1 for v in values if v == latest)
    pct = min(0.9995, max(0.0005, (below + 0.5 * equal) / n))
    return _clamp(statistics.NormalDist().inv_cdf(pct))


def _series_z(series: list[tuple[float, datetime]], metric: str, now: datetime) -> dict:
    """z-score result for an ordered (value, ts) series. `stale` if too few/aged.

    A per-metric transform (e.g. `log1p` for precipitation) is applied only to the
    values feeding the mean/std/z statistic, to tame skewed distributions; the raw
    `latest` and `series` are left untouched so the API/overlay show real values."""
    minpts = config.MIN_BASELINE_BY_METRIC.get(metric, config.MIN_BASELINE_POINTS)
    values = [v for v, _ in series]
    latest, latest_ts = series[-1]
    if len(series) < minpts:
        return {"stale": True, "metric": metric, "n": len(series), "latest": latest, "series": values[-40:]}
    if metric == "weather_precip" and config.PRECIP_PERCENTILE:
        # empirical-CDF percentile anomaly (robust to precip's skew) — raw mm preserved
        z = _percentile_z(latest, values)
        mean, std = statistics.fmean(values), statistics.pstdev(values)
    else:
        tf = _TRANSFORMS.get(config.METRIC_TRANSFORM.get(metric, ""))
        tvalues = [tf(v) for v in values] if tf else values
        mean = statistics.fmean(tvalues)
        std = statistics.pstdev(tvalues)
        z = 0.0 if std == 0 else _clamp((tvalues[-1] - mean) / std)
    age_s = (now - latest_ts).total_seconds()
    coverage = math.exp(-age_s / config.TAU_SECONDS.get(metric, config.DEFAULT_TAU))
    return {"metric": metric, "z": round(z, 3), "mean": round(mean, 4), "std": round(std, 4),
            "latest": latest, "n": len(values), "age_min": round(age_s / 60),
            "coverage": round(coverage, 3), "ts": latest_ts.isoformat(), "series": values[-40:]}


HIGH_FREQ = {"equity_index", "fx_usd", "news_tone", "news_goldstein", "news_volume",
             "weather_temp", "weather_precip", "weather_wind"}


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


def _climatology(country: str, metric: str, now: datetime) -> tuple[float, float] | None:
    """Day-of-year climatological (mean, sd) for a metric, ±CLIMO_WINDOW_DAYS-smoothed;
    None if no normals are stored for this country/metric."""
    rows = db.normals_window(_conn, country, metric, _window_doys(_doy(now), config.CLIMO_WINDOW_DAYS))
    if not rows:
        return None
    return statistics.fmean([r[0] for r in rows]), statistics.fmean([r[1] for r in rows])


def _clim_z(series: list[tuple[float, datetime]], metric: str, clim: tuple[float, float], now: datetime) -> dict:
    """z vs the day-of-year climatological (mean, sd). Warms up immediately — a normal
    plus recent observations suffice (no self-baseline min). Compares a recent ~daily
    MEAN (not a single diurnal reading) to the daily-mean normal, so time-of-day does
    not bias the anomaly."""
    mean, sd = clim
    latest, latest_ts = series[-1]
    cutoff = latest_ts - timedelta(hours=24)
    recent = [(v, t) for v, t in series if t >= cutoff]
    span_h = (recent[-1][1] - recent[0][1]).total_seconds() / 3600 if len(recent) > 1 else 0.0
    if span_h < config.CLIMO_MIN_SPAN_HOURS:
        # not a full diurnal cycle yet — a daily-mean anomaly would be time-of-day biased
        return {"stale": True, "metric": metric, "n": len(series), "latest": latest,
                "series": [v for v, _ in series][-40:]}
    value = statistics.fmean([v for v, _ in recent])
    z = 0.0 if sd == 0 else _clamp((value - mean) / sd)
    age_s = (now - latest_ts).total_seconds()
    coverage = math.exp(-age_s / config.TAU_SECONDS.get(metric, config.DEFAULT_TAU))
    values = [v for v, _ in series]
    return {"metric": metric, "z": round(z, 3), "mean": round(mean, 4), "std": round(sd, 4),
            "latest": round(value, 2), "n": len(values), "age_min": round(age_s / 60),
            "coverage": round(coverage, 3), "ts": latest_ts.isoformat(),
            "series": values[-40:], "baseline": "climatology"}


def metric_z(country: str, metric: str, now: datetime) -> dict | None:
    series = baseline_series(country, metric, now)
    if not series:
        return None
    # day-of-year climatology when available (removes seasonal drift + warms up fast);
    # otherwise the 90-day self-window fallback.
    if metric in config.CLIMATOLOGY_METRICS:
        clim = _climatology(country, metric, now)
        if clim and clim[1] > 0:
            return _clim_z(series, metric, clim, now)
    return _series_z(series, metric, now)


def score_domain(country: str, domain: str, now: datetime) -> dict | None:
    """Staleness-discounted weighted rollup of the domain's metrics.

    Directionality (`SIDED`) is applied in the four-state mapping via `_dir_mag`.
    A single-metric facet domain (e.g. `weather_precip`) inherits its one metric's
    sidedness so the domain z's non-hazard tail clamps to operational; a multi-metric
    domain stays two-sided. The returned `mag` is the directional magnitude the
    hysteresis machine gates on, keeping directionality consistent through commit."""
    weights = config.WEIGHTS[domain]
    total_w = sum(weights.values())
    metric_names = list(weights.keys())
    domain_sided = config.SIDED.get(metric_names[0], "both") if len(metric_names) == 1 else "both"
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
        per_metric[metric] = _state_from_z(_dir_mag(mz["z"], config.SIDED.get(metric, "both")))
        contrib = e * abs(mz["z"])
        if contrib > driver_contrib:
            driver_contrib, driver = contrib, mz
    if not per_metric:
        return None
    coverage = eff_w / total_w if total_w else 0.0
    if eff_w == 0 or coverage < config.COVERAGE_MIN:
        return {"state": "stale", "value": None, "z": 0.0, "mag": 0.0, "domain": domain,
                "coverage": round(coverage, 3), "per_metric": per_metric, "driver": driver}
    domain_z = weighted_z / eff_w
    mag = _dir_mag(domain_z, domain_sided)
    return {"state": _state_from_z(mag), "value": round(domain_z, 3), "z": round(domain_z, 3),
            "mag": round(mag, 3), "domain": domain, "coverage": round(coverage, 3),
            "per_metric": per_metric, "driver": driver}


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
        return {"state": "stale", "value": None, "z": 0.0, "mag": 0.0, "domain": "relations",
                "coverage": 0.0, "per_metric": {"gdelt_tone": "stale"}, "driver": mz}
    mag = _dir_mag(mz["z"], config.SIDED.get("gdelt_tone", "both"))
    st = _state_from_z(mag)
    return {"state": st, "value": mz["z"], "z": mz["z"], "mag": mag, "domain": "relations",
            "coverage": mz["coverage"], "per_metric": {"gdelt_tone": st}, "driver": mz}


def score_drought(country: str, now: datetime) -> dict | None:
    """`weather_drought` facet: precip accumulation DEFICIT vs the climatological normal
    over a long window (`low`-sided — only a shortfall escalates). Needs precip normals
    and enough of the window observed; stays `stale` until the observation window is
    sufficiently covered (so warm-up never fabricates a drought). None if no normals."""
    win, doy = config.DROUGHT_WINDOW_DAYS, _doy(now)
    exp = db.normals_window(_conn, country, "weather_precip", _last_doys(doy, win))
    if not exp:
        return None
    expected = sum(r[0] for r in exp)                       # climatological window total
    acc_sd = math.sqrt(sum(r[1] ** 2 for r in exp)) or 1.0  # accumulation sd (indep. approx)
    rows = db.query(
        _conn,
        "SELECT value, ts FROM observation WHERE country=%s AND metric='weather_precip' AND ts > %s",
        (country, now - timedelta(days=win)),
    )
    if not rows:
        return None
    actual = sum(float(v) for v, _ in rows)
    latest_ts = max(t for _, t in rows)
    win_cov = len({t.date() for _, t in rows}) / win       # fraction of window observed
    driver = {"metric": "weather_precip", "z": None, "mean": round(expected, 2),
              "std": round(acc_sd, 2), "latest": round(actual, 2),
              "age_min": round((now - latest_ts).total_seconds() / 60), "series": []}
    if win_cov < config.COVERAGE_MIN:
        return {"state": "stale", "value": None, "z": 0.0, "mag": 0.0, "domain": "weather_drought",
                "coverage": round(win_cov, 3), "per_metric": {"weather_precip": "stale"}, "driver": driver}
    z = _clamp((actual - expected) / acc_sd)               # negative => deficit
    mag = _dir_mag(z, "low")
    st = _state_from_z(mag)
    driver["z"] = round(z, 3)
    return {"state": st, "value": round(z, 3), "z": round(z, 3), "mag": round(mag, 3),
            "domain": "weather_drought", "coverage": round(win_cov, 3),
            "per_metric": {"weather_precip": st}, "driver": driver}


# ---- hysteresis (NFR-4) — pure logic in common.hysteresis (unit-tested) ----
def apply_hysteresis(country: str, domain: str, res: dict) -> str:
    row = db.query(
        _conn,
        "SELECT committed_state, candidate_state, candidate_count FROM domain_state "
        "WHERE country=%s AND domain=%s",
        (country, domain),
    )
    prev_committed = row[0][0] if row else None
    # gate on the directional magnitude (`mag`) so a one-sided facet's non-hazard
    # tail never escalates through hysteresis; falls back to |z| for older results.
    mag = res.get("mag", abs(res["z"]))
    desired = "stale" if res["state"] == "stale" else hysteresis.desired_state(prev_committed, mag)

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


# domains that feed the worst-of composite. `news` and the weather facets are
# deliberately absent — standalone, never a composite vote (news is already
# GDELT-derived like relations; weather is an adjacent stressor, not
# geopolitical-risk state itself).
COMPOSITE_DOMAINS = {"markets", "economy", "relations"}

# domains eligible to OPEN incidents. Decoupled from the composite so the weather
# facets can raise flood/wind/heat-cold anomaly incidents without joining the
# composite; `news` stays absent (no news-driven incidents in v1 — feed noise).
INCIDENT_DOMAINS = COMPOSITE_DOMAINS | set(config.WEATHER_FACETS) | {"weather_drought"}


def composite_of(committed: dict[str, str]) -> tuple[str, list[str]]:
    considered = {d: s for d, s in committed.items() if d in COMPOSITE_DOMAINS}
    non_stale = {d: s for d, s in considered.items() if s in STATE_RANK}
    if non_stale:
        worst = max(non_stale, key=lambda d: STATE_RANK[non_stale[d]])
        return non_stale[worst], [worst]
    return "stale", list(considered.keys())


def _incident_title(name: str, domain: str, state: str, drv: dict) -> str:
    """Human-readable incident title. Each weather facet reads on its own terms —
    temperature as a heat/cold anomaly by the sign of its driver z, precipitation as
    flood risk, wind as a wind event; other domains read as `<domain> <state>`."""
    if domain == "weather_temp":
        kind = "heat" if (drv.get("z") or 0) > 0 else "cold"
        return f"{name} · {kind} anomaly"
    if domain == "weather_precip":
        return f"{name} · flood risk"
    if domain == "weather_wind":
        return f"{name} · wind event"
    if domain == "weather_drought":
        return f"{name} · drought"
    return f"{name} · {domain} {state}"


def incident_lifecycle(country: str, committed: dict[str, str], raw: dict[str, dict]) -> None:
    name = NAMES.get(country, country)
    for domain, state in committed.items():
        if domain not in INCIDENT_DOMAINS:
            continue  # news is standalone — no news-driven incidents in v1 (feed noise)
        dedup = f"{country}:{domain}"
        # each weather facet opens incidents only at its configured floor (disrupted
        # by default) so common |z| 1-2 swings don't flood the feed; other domains
        # open at degraded too.
        floor = config.WEATHER_INCIDENT_FLOORS.get(domain)
        if floor is not None:
            open_states = ("disrupted",) if floor == "disrupted" else ("degraded", "disrupted")
        else:
            open_states = ("degraded", "disrupted")
        if state in open_states:
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
                     _incident_title(name, domain, state, drv), Json(detail)),
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
        # `news` and the weather facets are scored via the same generic rollup but
        # are standalone: persisted and colored, yet excluded from the composite
        # (composite_of). `news` is also excluded from incidents; each weather facet
        # opens its own incident at the disrupted floor (see INCIDENT_DOMAINS /
        # incident_lifecycle). Single-metric facets carry no cross-hazard blending.
        for domain in ("markets", "economy", "news", *config.WEATHER_FACETS):
            r = score_domain(country, domain, now)
            if r:
                raw[domain] = r
        rel = score_relations(country, now)
        if rel:
            raw["relations"] = rel
        # `weather_drought` is scored on its own long-window deficit path (not the
        # generic single-metric rollup), then flows through hysteresis/incidents like
        # any facet; standalone, so it never enters the composite.
        dr = score_drought(country, now)
        if dr:
            raw["weather_drought"] = dr
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
