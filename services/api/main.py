"""api — FastAPI REST + SSE for the frontend (capabilities: api-service, live-updates).

Read-only, CORS-enabled, OpenAPI-documented. Serves composite tiles, a per-country
breakdown (auditable, NFR-6), incidents, and a Server-Sent-Events stream (ADR-004)
that pushes tile-state and incident lifecycle diffs. A background poller diffs the
DB every few seconds and broadcasts to all SSE subscribers.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from psycopg_pool import ConnectionPool

from common import config, db
from common.log import get_logger

log = get_logger("api")

NAMES: dict[str, tuple[str, str]] = {
    "USA": ("United States", "North America"), "JPN": ("Japan", "East Asia"),
    "DEU": ("Germany", "Central Europe"), "FRA": ("France", "Western Europe"),
    "CHE": ("Switzerland", "Central Europe"), "GBR": ("United Kingdom", "Western Europe"),
    "CHN": ("China", "East Asia"), "BRA": ("Brazil", "South America"),
    "ARG": ("Argentina", "South America"), "IND": ("India", "South Asia"),
    "KOR": ("South Korea", "East Asia"), "CAN": ("Canada", "North America"),
    "RUS": ("Russia", "Eurasia"), "TWN": ("Taiwan", "East Asia"), "ISR": ("Israel", "Middle East"),
    "IRN": ("Iran", "Middle East"), "TUR": ("Turkey", "Middle East"), "UKR": ("Ukraine", "Eastern Europe"),
    "AUS": ("Australia", "Oceania"), "NGA": ("Nigeria", "West Africa"), "NZL": ("New Zealand", "Oceania"),
    "PSE": ("Palestine", "Middle East"), "NLD": ("Netherlands", "Western Europe"),
}

pool = ConnectionPool(config.DATABASE_URL, min_size=1, max_size=6, open=False)
subscribers: set[asyncio.Queue] = set()
snapshot: dict[str, dict] = {"tiles": {}, "incidents": {}}


def _name(iso3: str) -> str:
    return NAMES.get(iso3, (iso3, ""))[0]


def _age_min(ts: datetime | None) -> int | None:
    return None if ts is None else round((datetime.now(timezone.utc) - ts).total_seconds() / 60)


def q(sql: str, params: tuple = ()) -> list[tuple]:
    with pool.connection() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() if cur.description else []


# ---- SSE background poller ----
def _tiles_state() -> dict[str, str]:
    return {r[0].strip(): r[1] for r in q(
        "SELECT DISTINCT ON (country) country, state FROM score WHERE domain='composite' "
        "ORDER BY country, computed_at DESC")}


def _incident_status() -> dict[str, dict]:
    out = {}
    for id_, sev, resolved in q("SELECT id, severity, resolved_at FROM incident ORDER BY started_at DESC LIMIT 300"):
        out[str(id_)] = {"status": "resolved" if resolved else "ongoing", "severity": sev}
    return out


async def poller():
    try:
        snapshot["tiles"] = await asyncio.to_thread(_tiles_state)
        snapshot["incidents"] = await asyncio.to_thread(_incident_status)
    except Exception as exc:  # noqa: BLE001
        log.warning("poller seed failed: %s", exc)
    while True:
        await asyncio.sleep(3)
        try:
            tiles = await asyncio.to_thread(_tiles_state)
            incs = await asyncio.to_thread(_incident_status)
        except Exception:  # noqa: BLE001
            continue
        events = []
        for country, state in tiles.items():
            if snapshot["tiles"].get(country) != state:
                events.append({"type": "tile", "country": country, "state": state})
        for id_, info in incs.items():
            prev = snapshot["incidents"].get(id_)
            if prev is None or prev["status"] != info["status"]:
                events.append({"type": "incident", "id": id_, "status": info["status"], "severity": info["severity"]})
        snapshot["tiles"], snapshot["incidents"] = tiles, incs
        for ev in events:
            for sub in list(subscribers):
                sub.put_nowait(ev)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    pool.open()
    task = asyncio.create_task(poller())
    yield
    task.cancel()
    pool.close()


app = FastAPI(title="GeoPulse API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.API_CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


@app.get("/api/health")
def health():
    q("SELECT 1")
    return {"status": "ok"}


@app.get("/api/tiles")
def tiles():
    return [
        {"country": c.strip(), "state": s, "value": float(v) if v is not None else None, "computed_at": t.isoformat()}
        for c, s, v, t in q(
            "SELECT DISTINCT ON (country) country, state, value, computed_at FROM score "
            "WHERE domain='composite' ORDER BY country, computed_at DESC")
    ]


def _band(tone: float) -> str:
    return "hostile" if tone <= -0.5 else ("tense" if tone < 0.4 else "warm")


def _incident_row(r) -> dict:
    id_, sev, countries, metric, threshold, title, started, resolved, has_chart = r
    return {
        "id": str(id_), "severity": sev, "countries": [c.strip() for c in countries], "metric": metric,
        "threshold": threshold, "title": title, "startedAt": started.isoformat(),
        "resolvedAt": resolved.isoformat() if resolved else None,
        "status": "resolved" if resolved else "ongoing", "hasChart": bool(has_chart),
    }


@app.get("/api/incidents")
def incidents(status: str = "all"):
    where = {"ongoing": "WHERE resolved_at IS NULL", "resolved": "WHERE resolved_at IS NOT NULL"}.get(status, "")
    rows = q(
        "SELECT id, severity, countries, metric, threshold, title, started_at, resolved_at, "
        "(detail->'series') IS NOT NULL AND jsonb_array_length(coalesce(detail->'series','[]')) > 0 "
        f"FROM incident {where} ORDER BY started_at DESC LIMIT 100")
    return [_incident_row(r) for r in rows]


@app.get("/api/incidents/{incident_id}")
def incident(incident_id: str):
    rows = q(
        "SELECT id, severity, countries, metric, threshold, title, started_at, resolved_at, detail "
        "FROM incident WHERE id=%s", (incident_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="unknown incident")
    id_, sev, countries, metric, threshold, title, started, resolved, detail = rows[0]
    return {
        "id": str(id_), "severity": sev, "countries": [c.strip() for c in countries], "metric": metric,
        "threshold": threshold, "title": title, "startedAt": started.isoformat(),
        "resolvedAt": resolved.isoformat() if resolved else None,
        "status": "resolved" if resolved else "ongoing", "detail": detail,
    }


@app.get("/api/weather")
def weather():
    """Per-country weather aggregates + per-facet committed anomaly state, for the
    switchable Meteorological overlay. One payload carries all three facets so the
    globe switches modes client-side without refetching: `tempC` is the 7-day mean,
    `precipMm` the 7-day total, `windMax` the 7-day maximum of the raw (untransformed)
    observations; `states` holds each facet's committed anomaly state and `z` its signed
    anomaly z (from the facet score, null where stale), so the overlay can also color by
    the per-country anomaly without a refetch. A country with partial history is still
    returned with its available aggregate(s), the missing facet reported `stale`."""
    rows = q(
        "SELECT country, "
        "avg(value) FILTER (WHERE metric='weather_temp'), "
        "sum(value) FILTER (WHERE metric='weather_precip'), "
        "max(value) FILTER (WHERE metric='weather_wind'), "
        "max(ts) "
        "FROM observation "
        "WHERE metric IN ('weather_temp','weather_precip','weather_wind') "
        "AND ts > now() - interval '7 days' GROUP BY country")
    # (state, value=signed z) per (country, facet) from the latest facet score row
    facet: dict[tuple[str, str], tuple[str, float | None]] = {}
    for c, dom, s, v in q(
        "SELECT DISTINCT ON (country, domain) country, domain, state, value FROM score "
        "WHERE domain IN ('weather_temp','weather_precip','weather_wind') "
        "ORDER BY country, domain, computed_at DESC"):
        facet[(c.strip(), dom)] = (s, v)

    def _facet(iso: str, dom: str) -> tuple[str, float | None]:
        st, v = facet.get((iso, dom), ("stale", None))
        z = round(float(v), 2) if (v is not None and st != "stale") else None
        return st, z

    out = []
    for c, temp, precip, wind, ts in rows:
        iso = c.strip()
        (ts_s, ts_z), (pr_s, pr_z), (wn_s, wn_z) = (
            _facet(iso, "weather_temp"), _facet(iso, "weather_precip"), _facet(iso, "weather_wind"))
        out.append({
            "country": iso,
            "tempC": round(float(temp), 1) if temp is not None else None,
            "precipMm": round(float(precip), 1) if precip is not None else None,
            "windMax": round(float(wind), 1) if wind is not None else None,
            "states": {"temp": ts_s, "precip": pr_s, "wind": wn_s},
            "z": {"temp": ts_z, "precip": pr_z, "wind": wn_z},
            "ageMin": _age_min(ts),
        })
    return out


@app.get("/api/weather-field")
def weather_field():
    """Cached global atmospheric-field grid (cloud/wind/precip) for the Meteorological
    overlay's lifted shell. Ambient only — the field has no country and no z-score, and
    is served straight from the single cached blob. Returns an empty payload before the
    worker's first fetch, rather than fabricating cells or failing."""
    with pool.connection() as c:
        row = db.latest_weather_field(c)
    if not row:
        return {"nlat": 0, "nlon": 0, "cloud": [], "u": [], "v": [], "precip": [], "ts": None, "ageMin": None}
    grid, updated_at = row
    grid = dict(grid)
    grid["ageMin"] = _age_min(updated_at)
    return grid


@app.get("/api/storms")
def storms():
    """Active tropical cyclones (position, category, forecast track) from the cached
    blob, for the Meteorological overlay's live storm spirals. Feature data only —
    storms open `country:storm` incidents but have no per-country score. Returns an
    empty list when none are active or before the worker's first fetch."""
    with pool.connection() as c:
        row = db.latest_storms(c)
    if not row:
        return {"storms": [], "ageMin": None}
    storms_list, updated_at = row
    return {"storms": storms_list, "ageMin": _age_min(updated_at)}


@app.get("/api/arcs")
def arcs():
    """Global tone-scored dyad pairs for the relation arc layer."""
    rows = q(
        "SELECT DISTINCT ON (country_a, country_b) country_a, country_b, value FROM dyad_observation "
        "WHERE metric='gdelt_tone' ORDER BY country_a, country_b, ts DESC")
    pairs = [{"a": a.strip(), "b": b.strip(), "tone": round(max(-2.0, min(2.0, float(v) / 5.0)), 2)}
             for a, b, v in rows if a.strip() != b.strip()]
    pairs.sort(key=lambda p: abs(p["tone"]), reverse=True)
    return pairs[:80]


# drill-down metric slots -> (label, underlying metric, domain, unit, source)
_SLOTS = [
    ("equity", "Equity index", "equity_index", "markets", "", "Twelve Data"),
    ("bond10y", "10Y yield", None, None, "", "—"),
    ("fx", "FX / USD", "fx_usd", "markets", "", "open.er-api"),
    ("cpi", "CPI (YoY)", "macro_cpi", "economy", "%", "World Bank"),
    ("gdp", "GDP growth", "macro_gdp_growth", "economy", "%", "World Bank"),
    ("debt", "Debt / GDP", "macro_debt_gdp", "economy", "%", "World Bank"),
]

# standalone News-domain metric rows (GDELT-derived, article-weighted).
_NEWS_SLOTS = [
    ("news_tone", "News tone", "news_tone", "news", "", "GDELT"),
    ("news_goldstein", "Conflict intensity", "news_goldstein", "news", "", "GDELT"),
    ("news_volume", "Coverage volume", "news_volume", "news", "", "GDELT"),
]

# weather facets in the drill-down: (label, unit, aggregate over the last 7 days).
_WEATHER_AGG = {
    "weather_temp": ("Temperature", "°C", "avg"),
    "weather_precip": ("Precipitation", "mm", "sum"),
    "weather_wind": ("Wind", "km/h", "max"),
}


def _weather_facets(iso3: str) -> list[dict]:
    """Per-country weather facet rows (committed state + latest aggregate + anomaly z +
    age + series), auditable like the other domains. Standalone — scored and
    incident-driving, but never part of the worst-of composite. Includes whatever
    facets have a score for the country (so a drought facet appears automatically)."""
    scored = {d: (s, v) for d, s, v in q(
        "SELECT DISTINCT ON (domain) domain, state, value FROM score WHERE country=%s "
        "AND domain IN ('weather_temp','weather_precip','weather_wind','weather_drought') "
        "ORDER BY domain, computed_at DESC", (iso3,))}
    out = []
    for dom, (label, unit, agg) in _WEATHER_AGG.items():
        if dom not in scored:
            continue
        st, zval = scored[dom]
        arow = q(f"SELECT {agg}(value), max(ts) FROM observation "
                 "WHERE country=%s AND metric=%s AND ts > now() - interval '7 days'", (iso3, dom))
        val, ts = arow[0] if arow else (None, None)
        srow = q("SELECT value FROM observation WHERE country=%s AND metric=%s ORDER BY ts DESC LIMIT 30", (iso3, dom))
        out.append({
            "key": dom, "label": label,
            "value": f"{float(val):,.1f}{unit}" if val is not None else "—",
            "state": st, "z": round(float(zval), 2) if zval is not None else None,
            "ageMin": _age_min(ts), "series": [float(v) for (v,) in reversed(srow)],
        })
    if "weather_drought" in scored:  # derived facet — no simple aggregate to show
        st, zval = scored["weather_drought"]
        out.append({
            "key": "weather_drought", "label": "Drought",
            "value": "in deficit" if st in ("degraded", "disrupted") else "—",
            "state": st, "z": round(float(zval), 2) if zval is not None else None,
            "ageMin": None, "series": [],
        })
    return out


def _metric_row(iso3: str, key: str, label: str, metric: str | None, state: str, unit: str, source: str) -> dict:
    if metric is None:
        return {"key": key, "label": label, "value": "—", "delta": None, "state": "stale",
                "source": "—", "ageMin": None, "series": []}
    rows = q("SELECT value, ts FROM observation WHERE country=%s AND metric=%s ORDER BY ts DESC LIMIT 30",
             (iso3, metric))
    if not rows:
        return {"key": key, "label": label, "value": "—", "delta": None, "state": "stale",
                "source": "—", "ageMin": None, "series": []}
    series = [float(v) for v, _ in reversed(rows)]
    latest, ts = float(rows[0][0]), rows[0][1]
    delta = None
    if len(rows) > 1 and float(rows[1][0]) != 0:
        delta = f"{(latest - float(rows[1][0])) / abs(float(rows[1][0])) * 100:+.1f}%"
    return {"key": key, "label": label, "value": f"{latest:,.2f}{unit}", "delta": delta,
            "state": state, "source": source, "ageMin": _age_min(ts), "series": series}


@app.get("/api/countries/{iso3}")
def country(iso3: str):
    iso3 = iso3.upper()
    dstate = {d: (s, t) for d, s, t in q(
        "SELECT DISTINCT ON (domain) domain, state, computed_at FROM score WHERE country=%s "
        "ORDER BY domain, computed_at DESC", (iso3,))}
    # per-metric states from the domain inputs (auditable decomposition)
    per_metric: dict[str, str] = {}
    for _dom, inputs in q("SELECT DISTINCT ON (domain) domain, inputs FROM score WHERE country=%s "
                          "AND domain IN ('markets','economy','news') ORDER BY domain, computed_at DESC", (iso3,)):
        per_metric.update((inputs or {}).get("per_metric") or {})

    has_obs = q("SELECT 1 FROM observation WHERE country=%s LIMIT 1", (iso3,))
    if not dstate and not has_obs:
        raise HTTPException(status_code=404, detail=f"no data for {iso3}")

    metrics = [_metric_row(iso3, key, label, metric, per_metric.get(metric or "", "stale"), unit, source)
               for key, label, metric, _domain, unit, source in _SLOTS]
    news_metrics = [_metric_row(iso3, key, label, metric, per_metric.get(metric or "", "stale"), unit, source)
                    for key, label, metric, _domain, unit, source in _NEWS_SLOTS]

    rrows = q("SELECT DISTINCT ON (country_b) country_b, value FROM dyad_observation "
              "WHERE country_a=%s AND metric='gdelt_tone' ORDER BY country_b, ts DESC", (iso3,))
    rels = sorted(rrows, key=lambda r: abs(float(r[1])), reverse=True)[:5]
    relations = [{"iso3": cb.strip(), "name": _name(cb.strip()), "tone": round(max(-2.0, min(2.0, float(raw) / 5.0)), 2),
                  "band": _band(max(-2.0, min(2.0, float(raw) / 5.0)))} for cb, raw in rels]

    active = [{"id": str(i), "severity": sev, "metric": m, "title": t, "startedAt": s.isoformat()}
              for i, sev, m, t, s in q(
                  "SELECT id, severity, metric, title, started_at FROM incident "
                  "WHERE %s = ANY(countries) AND resolved_at IS NULL ORDER BY started_at DESC", (iso3,))]

    return {
        "iso3": iso3, "name": _name(iso3), "region": NAMES.get(iso3, ("", ""))[1],
        "composite": dstate.get("composite", ("stale",))[0], "source": "scoring",
        "ageMin": _age_min(dstate["composite"][1]) if "composite" in dstate else None,
        "domains": {"economy": dstate.get("economy", ("stale",))[0], "markets": dstate.get("markets", ("stale",))[0],
                    "relations": dstate.get("relations", ("stale",))[0], "news": dstate.get("news", ("stale",))[0]},
        "metrics": metrics, "newsMetrics": news_metrics, "weatherFacets": _weather_facets(iso3),
        "relations": relations, "incidents": active,
    }


@app.get("/api/stream")
async def stream():
    queue: asyncio.Queue = asyncio.Queue()
    subscribers.add(queue)

    async def gen():
        try:
            yield ": connected\n\n"
            while True:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: {ev['type']}\ndata: {json.dumps(ev)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            subscribers.discard(queue)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})
