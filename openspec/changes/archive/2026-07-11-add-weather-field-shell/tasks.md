## 1. Field store (isolated from the scoring spine)

- [x] 1.1 Add a `weather_field` single-blob store (one row, overwritten each cycle) via the existing migration path in `services/common/`, isolated from `observation`/`score`/`incident` (a JSONB grid column + `updated_at`).
- [x] 1.2 Add a small helper in `services/common/db.py` (or nearby) to upsert the single field blob and read the latest, so the worker and API share one contract.

## 2. weather-field-worker (new process)

- [x] 2.1 Add grid + fetch config to `services/common/config.py`: grid step (default ~15°) and clamped extent (e.g. lat −60…75), slow cadence (default a few hours), Open-Meteo field params, and a per-request node cap.
- [x] 2.2 Create `services/weather-field-worker/main.py`: generate the grid nodes, fetch `cloud_cover,wind_speed_10m,wind_direction_10m,precipitation` in one (or a few) batched Open-Meteo `current=` requests, deriving `u=−speed·sin(dir)`, `v=−speed·cos(dir)` per node.
- [x] 2.3 Cache the result as the single grid blob (per-node `{lat,lon,cloud,u,v,precip}` + fetch `ts`), overwriting each cycle; reuse the token-bucket + own-scheduler + graceful-skip discipline (outage leaves the last blob in place, no crash, no bad write).
- [x] 2.4 Confirm the worker writes NO `observation`/`score`/`incident` rows and touches no scoring code (field is ambient-only).

## 3. API

- [x] 3.1 Add `GET /api/weather-field` to `services/api/main.py` returning grid metadata (`step`, extent, dims, `ts`, `ageMin`) + per-node values in one read-only, CORS-enabled response.
- [x] 3.2 Return an empty/absent field payload before the first fetch (warm-up) rather than failing; confirm `/api/tiles`, `/api/weather`, `/api/incidents` are unchanged.

## 4. Frontend: atmospheric field shell

- [x] 4.1 Add the field payload type + a `fetchWeatherField` helper (in `data/`), fetched once and held (re-render client-side, no per-frame fetch), degrading gracefully to empty when absent.
- [x] 4.2 Add a lifted cloud-shell render layer to `globe/Globe.tsx`: translucent shells/particles at grid nodes lifted above the surface, alpha by cloud %, reusing the existing `lift`/occlusion helpers (near-hemisphere only), drawn above the choropleth/spirals/labels.
- [x] 4.3 Gate the shell on the Meteorological overlay; optionally add wind-driven drift along node `(u,v)` respecting `reduceMotion`; add a cloud legend/sub-control to `panels/OverlayPanel.tsx` if it competes with the choropleth read.
- [x] 4.4 Confirm the temperature/precipitation/wind choropleth, mode selector, storm spirals, and numeric labels render unchanged beneath the shell.

## 5. Deployment

- [x] 5.1 Register `weather-field-worker` in `docker-compose.yml` (both profiles, shared services image, own command, `env_file`, restart policy), egress only to Open-Meteo; update README/deploy docs.

## 6. Methodology + docs

- [x] 6.1 Document the atmospheric field shell on the methodology page: it is ambient (global grid, no country, no z-score, not scored, not an incident source, not in the composite), that cloud cover lives only here, and that storm tracks remain Phase 4.

## 7. Verification

- [x] 7.1 Confirm one worker cycle populates the single field blob from a batched call, a provider outage leaves the last blob in place (no crash), and no `observation`/`score`/`incident` rows are written.
- [x] 7.2 Confirm `GET /api/weather-field` returns the grid + `ageMin` in one response, returns empty before warm-up, and leaves `/api/tiles`/`/api/weather`/`/api/incidents` unchanged.
- [x] 7.3 Confirm the overlay renders the cloud shell lifted and occlusion-correct on rotation, shows an honest empty state without field data, and that motion holds static under `reduceMotion`.
- [x] 7.4 Confirm the shell coexists with the temp/precip/wind choropleth (facets, incidents, composite unchanged), and that disabling the field leaves the rest of the app working.
