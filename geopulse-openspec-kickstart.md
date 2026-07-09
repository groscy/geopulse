# GeoPulse — OpenSpec Kickstart

**Working title:** GeoPulse (rename freely)
**Status:** Draft v0.1 — 2026-07-08
**Owner:** Cyril
**One-liner:** A status page for the planet — a 3D globe where every country is a health tile computed from quasi-real-time economic, market, and geopolitical signals, presented in the visual language of the AWS Health Dashboard.

---

## 1. Purpose & Vision

Operations teams get a single pane of glass for their infrastructure; there is no equivalent for the world. GeoPulse renders each country as a service with a composite state (Operational / Degraded / Disrupted), backed by transparent underlying metrics, an incident-style event feed, and bilateral relation arcs. The goal is situational awareness, not prediction: the system surfaces *what changed, when, and by how much relative to that country's own baseline* — never editorial judgment disguised as data.

**Non-goals (v1):** forecasting, trading signals, per-company equity data, mobile app, multi-user accounts, historical replay beyond 90 days.

## 2. Functional Requirements

- **FR-1 Globe view.** Interactive 3D globe with country choropleth colored by composite state. Rotate, zoom, hover tooltip, click to drill down.
- **FR-2 Domain layers.** Toggleable layers: Economy, Markets, Relations (arcs between country pairs colored by GDELT tone), Conflict overlay (optional, ACLED).
- **FR-3 Country drill-down panel.** Per-country: composite state with breakdown by domain, sparklines for key metrics (index level, 10Y yield, FX vs USD, inflation, GDP growth, debt/GDP), top bilateral relations by |tone|, active incidents.
- **FR-4 Incident feed.** Global chronological feed of threshold crossings ("JPY realized vol > p95 since 09:40 UTC", "GDELT tone US↔CN below p10"). Each incident: severity, affected countries, triggering metric, start time, resolution time.
- **FR-5 Staleness indicators.** Every displayed value shows source and age; scores computed from stale data are visually flagged (grey hatch / clock icon), never silently presented as current.
- **FR-6 Methodology page.** Full disclosure of scoring formula, weights, baselines, and source cadences.

## 3. Non-Functional Requirements

- **NFR-1 Local-first.** Entire stack runs on one machine via Docker Compose; only egress is to upstream public APIs. No cloud dependency. (Fits the planned AI workstation as a host.)
- **NFR-2 Refresh cadence.** Markets ≤ 5 min for ~30 major indices; GDELT 15 min; macro daily; structural quarterly.
- **NFR-3 Rate-limit resilience.** All fetchers respect provider quotas with token buckets; degradation is graceful (stale-flag, not error).
- **NFR-4 Score stability.** Hysteresis on state transitions — a tile must hold a new state for N consecutive evaluations before flipping (default N=3) to prevent flapping.
- **NFR-5 Frontend budget.** Initial load < 3 MB gzipped excluding basemap; 60 fps globe interaction on Apple Silicon / mid-range GPU.
- **NFR-6 Auditability.** Every score decomposable to raw observations: `score → domain scores → z-scores → (value, source, timestamp)`.

## 4. Architecture Overview

```
┌────────────────────────────  Host (Docker Compose)  ───────────────────────────┐
│                                                                                 │
│  Ingestion workers (one container per source family, own scheduler each)        │
│   ├─ markets-worker     Finnhub / Twelve Data / Stooq fallback      ~5 min      │
│   ├─ fx-worker          exchangerate.host                           ~15 min     │
│   ├─ gdelt-worker       GDELT 2.0 events + tone (country dyads)     15 min      │
│   ├─ macro-worker       World Bank, IMF SDMX, OECD, FRED, Eurostat  daily       │
│   └─ conflict-worker    ACLED / UCDP                                daily       │
│              │  normalize → Observation(country, metric, value, ts,             │
│              ▼             source, confidence)                                   │
│  TimescaleDB (observations hypertable, continuous aggregates)                    │
│              │                                                                   │
│  scoring-engine (runs every 5 min)                                               │
│   ├─ rolling per-country baselines (90d) → z-scores                              │
│   ├─ domain rollups: economy / markets / relations                               │
│   ├─ composite state + hysteresis                                                │
│   └─ threshold detector → incidents table                                        │
│              │                                                                   │
│  api (FastAPI): REST + SSE stream for live tile/incident updates                 │
│              │                                                                   │
│  frontend (globe.gl + deck.gl arc layer, Vite/React, served statically)          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 5. Data Model (core tables)

```sql
observation(country char(3), metric text, value double, ts timestamptz,
            source text, confidence real, PRIMARY KEY (country, metric, ts, source))
-- Timescale hypertable, 90d retention for high-frequency metrics

dyad_observation(country_a char(3), country_b char(3), metric text,  -- e.g. gdelt_tone
                 value double, ts timestamptz, source text)

score(country char(3), domain text,  -- economy|markets|relations|composite
      value real, state text,        -- operational|degraded|disrupted|stale
      computed_at timestamptz, inputs jsonb)  -- decomposition for auditability

incident(id uuid, severity text, countries char(3)[], metric text,
         threshold text, started_at timestamptz, resolved_at timestamptz,
         title text, detail jsonb)
```

## 6. Scoring (v1 formula, deliberately simple)

1. Per metric: `z = (x − μ_90d) / σ_90d` against the country's **own** rolling baseline.
2. Domain score = weighted mean of clamped z-scores (clamp ±4), weights in config, staleness-discounted: weight × exp(−age/τ_metric).
3. State mapping: |domain z| < 1 → Operational; 1–2 → Degraded; > 2 → Disrupted; effective data coverage < 50% → Stale.
4. Composite = worst of the three domains (AWS-style: a service is as healthy as its worst subsystem), shown alongside per-domain chips.
5. Hysteresis per NFR-4.

## 7. Key Decisions (ADR summaries)

### ADR-001: TimescaleDB over SQLite+DuckDB
**Accepted.** Continuous aggregates and retention policies replace hand-rolled rollup jobs; single Postgres container keeps ops trivial. SQLite+DuckDB stays viable as a later "lite mode" but two-engine sync isn't worth it for v1. *Trade-off:* heavier than SQLite; acceptable on the target workstation.

### ADR-002: globe.gl (+ deck.gl ArcLayer) over CesiumJS
**Accepted.** No terrain/imagery requirement; globe.gl gives choropleth + arcs + points with minimal code and meets the 60 fps budget. CesiumJS adds ~10× complexity for unused capability. *Revisit if:* time-zoomable historical replay or satellite basemaps become requirements.

### ADR-003: Per-country baselines over global normalization
**Accepted.** A 2% index move is noise in Buenos Aires and a headline in Zurich. Self-relative z-scores keep the map honest and remove developed-market bias. *Consequence:* new countries need a 30d warm-up before scoring (shown as Stale).

### ADR-004: SSE over WebSockets for live updates
**Accepted.** Updates are strictly server→client, low frequency (tile diffs + incidents); SSE is simpler, proxy-friendly, auto-reconnecting. *Revisit if:* client-side annotations/collab appear.

### ADR-005: Worst-of composite over weighted-average composite
**Accepted.** Matches the AWS mental model and avoids averaging away a crisis in one domain. Per-domain chips prevent loss of nuance. *Trade-off:* more red on the map; mitigated by hysteresis.

## 8. Milestones

- **M1 — Walking skeleton (1–2 wk):** gdelt-worker + markets-worker (10 indices), observations table, static scoring, globe with composite choropleth. No incidents, no panel.
- **M2 — Drill-down + incidents (2 wk):** country panel with sparklines, threshold detector, SSE feed, staleness flags.
- **M3 — Full sources (2–3 wk):** macro-worker (WB/IMF/OECD/FRED), FX, relations arc layer, methodology page.
- **M4 — Hardening:** rate-limit chaos testing, hysteresis tuning against 90d backfill, retention policies, Compose profiles for "lite" vs "full".

## 9. Risks & Open Questions

- **R-1** Free-tier market API limits may not cover 30 indices at 5 min → prioritize G20 + fallback to Stooq EOD with staleness flag.
- **R-2** GDELT tone is noisy at dyad level → require minimum event count per window before scoring a relation.
- **R-3** Composite scores read as authoritative → methodology page is a launch blocker, not a nice-to-have.
- **Q-1** Include CDS spreads (best sovereign-stress signal, but no good free source)? Park for v2.
- **Q-2** Conflict overlay in v1 or v2? Leaning v2 — ACLED licensing needs review.
