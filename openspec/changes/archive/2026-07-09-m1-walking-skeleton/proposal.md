## Why

There is no single pane of glass for the state of the world the way an ops team has one for its infrastructure. Before building the full multi-source, incident-driven product, we need a **walking skeleton** (Milestone M1): a thin vertical slice that proves the whole pipeline end-to-end — ingest → store → score → serve → render — with two data sources and a composite-colored globe. Everything after M1 (incidents, drill-down, more sources, hardening) hangs off this spine, so getting the seams right now is what makes the later milestones cheap.

This change delivers M1 and partially satisfies FR-1 (globe view), FR-6 groundwork (auditable scores), NFR-1 (local-first Compose), and NFR-6 (score decomposability).

## What Changes

- Stand up the **local-first stack** as Docker Compose services: TimescaleDB, two ingestion workers, a scoring engine, an API, and a static frontend — all on one host, egress only to public upstream APIs.
- Create the **observation store**: `observation` and `dyad_observation` tables as a TimescaleDB hypertable with the core schema from the kickstart.
- Ship two **ingestion workers**: `markets-worker` (≈10 major equity indices via Finnhub/Twelve Data with Stooq EOD fallback) and `gdelt-worker` (GDELT 2.0 tone at country-dyad level). Both normalize to the `Observation` shape with source + confidence + timestamp.
- Implement a **static scoring engine**: per-country self-relative z-scores over whatever history exists, weighted domain rollups (markets, relations), worst-of composite, and the four-state mapping (operational/degraded/disrupted/stale). Writes the `score` table with an `inputs` decomposition for auditability. No hysteresis and no incidents yet (deferred to M2).
- Expose a minimal **REST API** (FastAPI): a tiles endpoint returning composite state per country and a country endpoint returning its domain/metric breakdown.
- Render the **globe**: Vite + React app drawing a Canvas 2D globe with D3-geo orthographic projection, countries-110m topojson, composite-colored choropleth, rotate/zoom, hover tooltip, and click-to-recenter. No right panel, no incident feed, no overlays.

## Capabilities

### New Capabilities
- `observation-store`: TimescaleDB schema, hypertable, and migrations for `observation` and `dyad_observation`; the durable landing zone every worker writes to and the scoring engine reads from.
- `data-ingestion`: the worker framework (own scheduler per source family, normalization to `Observation`, basic per-provider token bucket) plus the two M1 workers — `markets-worker` and `gdelt-worker`.
- `scoring-engine`: static per-country z-scoring, weighted domain rollups, worst-of composite, four-state mapping, and the auditable `score` table.
- `api-service`: FastAPI REST endpoints that serve composite tiles and per-country breakdowns to the frontend.
- `globe-visualization`: the Canvas 2D / D3-geo orthographic globe with composite choropleth and core interactions (rotate, zoom, hover, click-recenter).

### Modified Capabilities
<!-- None. M1 is greenfield; openspec/specs/ is empty. -->

## Impact

- **New services** (all in `docker-compose.yml`): `db` (TimescaleDB), `markets-worker`, `gdelt-worker`, `scoring-engine`, `api`, `frontend`.
- **New dependencies**: TimescaleDB image; Python (FastAPI, httpx, psycopg/asyncpg, APScheduler or equivalent) for workers/scoring/api; Node (Vite, React, D3-geo, topojson-client, world-atlas) for the frontend.
- **External APIs**: Finnhub / Twelve Data / Stooq (markets), GDELT 2.0 (tone). Requires API keys (markets) via env; GDELT is keyless.
- **No** incidents, SSE, drill-down panel, FX/macro/conflict sources, relations arcs, or methodology page — those land in M2–M4.

## Depends On
- design-system
