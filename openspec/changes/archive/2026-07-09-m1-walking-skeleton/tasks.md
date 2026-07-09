## 1. Project scaffold & Compose

- [x] 1.1 Create repo layout: `services/{markets-worker,gdelt-worker,scoring-engine,api}`, `frontend/`, `db/migrations/`, `docker-compose.yml`, `.env.example`.
- [x] 1.2 Add `docker-compose.yml` with a `db` (TimescaleDB) service, named volume, and healthcheck.
- [x] 1.3 Define a shared Python base (deps: httpx, psycopg/asyncpg, pydantic, APScheduler) and a `common` module for the DB connection + `Observation` dataclass/model.
- [x] 1.4 Wire `docker compose up` to start db → workers → scoring → api → frontend in dependency order (depends_on + healthchecks).

## 2. Observation store

- [x] 2.1 Write migration: enable `timescaledb` extension; create `observation` table with PK `(country, metric, ts, source)`.
- [x] 2.2 Convert `observation` to a hypertable partitioned on `ts`; add index on `(country, metric, ts desc)`.
- [x] 2.3 Write migration: create `dyad_observation(country_a, country_b, metric, value, ts, source)` + index on `(country_a, country_b, metric, ts desc)`.
- [x] 2.4 Add an idempotent upsert helper (`ON CONFLICT (country, metric, ts, source) DO UPDATE`).
- [x] 2.5 Add migration runner that applies `db/migrations/*` at startup on an empty volume.

## 3. Ingestion framework

- [x] 3.1 Implement the worker base: scheduler loop, `Observation` normalization contract, ISO-3 country codes, structured logging.
- [x] 3.2 Implement a per-provider token-bucket rate limiter with graceful skip-on-exhaustion (no crash, no bad write).
- [ ] 3.3 Add an ISO-2/name → ISO-3 mapping utility shared by workers.

## 4. Markets worker

- [x] 4.1 Implement primary provider client (Finnhub or Twelve Data) for the ~10-index set; write `metric='equity_index'` observations at confidence 1.0.
- [ ] 4.2 Implement Stooq EOD fallback; on primary failure, write with `source='stooq'` and reduced confidence.
- [x] 4.3 Schedule on a ≤5 min cadence; verify observations land for all configured indices.

## 5. GDELT worker

- [x] 5.1 Implement GDELT 2.0 tone fetch at country-dyad level on a 15 min cadence.
- [x] 5.2 Enforce minimum-event-count-per-window before emitting a `gdelt_tone` dyad observation.
- [x] 5.3 Write `dyad_observation` rows; verify tone lands for high-volume pairs (e.g. USA↔CHN).

## 6. Scoring engine

- [x] 6.1 Load per-country rolling baselines (up to 90d) and compute per-metric z-scores; clamp to ±4.
- [x] 6.2 Implement staleness-discounted weighted domain rollups for `markets` and `relations` (weights + τ from config).
- [x] 6.3 Implement the four-state mapping and the <50%-coverage → `stale` rule.
- [x] 6.4 Implement worst-of composite; retain per-domain states.
- [x] 6.5 Write `score(country, domain, value, state, computed_at, inputs jsonb)` with a full metric-level `inputs` decomposition.
- [x] 6.6 Run the engine on a 5 min interval; confirm scores appear for countries with data and `stale` for warm-up cases.

## 7. API service

- [x] 7.1 Scaffold FastAPI app with CORS for the local frontend origin and OpenAPI enabled.
- [x] 7.2 Implement `GET /api/tiles` → `{ country, state, value, computed_at }[]` for all scored countries.
- [x] 7.3 Implement `GET /api/countries/{iso3}` → composite + per-domain states + metric observations from `inputs`; 404 on unknown.
- [x] 7.4 Add a `GET /api/health` readiness endpoint used by Compose healthcheck.

## 8. Frontend globe

- [x] 8.1 Scaffold Vite + React app; add D3-geo, topojson-client, world-atlas `countries-110m`, IBM Plex Sans/Mono.
- [x] 8.2 Implement the Canvas 2D orthographic globe: sphere, graticule, country polygons, devicePixelRatio scaling.
- [x] 8.3 Fetch `/api/tiles`, join to polygons by ISO-3, color by composite state; render stale as diagonal hatch, unscored as neutral land.
- [x] 8.4 Implement interactions: drag-to-rotate, zoom, hover tooltip (name + state), click-to-select + recenter on centroid, ocean-click deselect, idle auto-rotate with `reduceMotion` guard.
- [x] 8.5 Implement the top bar with global operational/degraded/disrupted/stale counts in mono numerals.
- [x] 8.6 Poll `/api/tiles` on an interval and re-render on change.

## 9. End-to-end verification

- [x] 9.1 On a clean checkout, `docker compose up` brings up all services with no manual steps.
- [x] 9.2 Confirm the full path: workers write observations → scores compute → `/api/tiles` returns them → globe colors countries.
- [x] 9.3 Spot-check auditability: pick one colored country and trace composite → domain → z → raw observation via `/api/countries/{iso3}`.
- [x] 9.4 Confirm `docker compose down -v` + up reproduces the stack from migrations.
