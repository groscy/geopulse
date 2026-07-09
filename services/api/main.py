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

from common import config
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
                          "AND domain IN ('markets','economy') ORDER BY domain, computed_at DESC", (iso3,)):
        per_metric.update((inputs or {}).get("per_metric") or {})

    has_obs = q("SELECT 1 FROM observation WHERE country=%s LIMIT 1", (iso3,))
    if not dstate and not has_obs:
        raise HTTPException(status_code=404, detail=f"no data for {iso3}")

    metrics = [_metric_row(iso3, key, label, metric, per_metric.get(metric or "", "stale"), unit, source)
               for key, label, metric, _domain, unit, source in _SLOTS]

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
                    "relations": dstate.get("relations", ("stale",))[0]},
        "metrics": metrics, "relations": relations, "incidents": active,
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
