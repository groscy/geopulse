## 1. Storm store (isolated)

- [x] 1.1 Add a `storm` single-blob store (one row, overwritten each cycle) via the migration path, isolated from `observation`/`score` (JSONB active-storm list + `updated_at`); add upsert/read helpers in `services/common/db.py`.

## 2. storm-worker (new process)

- [x] 2.1 Add config to `services/common/config.py`: NHC `CurrentStorms.json` URL, cadence, open/resolve proximity thresholds (km), and a category→severity map.
- [x] 2.2 Create `services/storm-worker/main.py`: fetch active cyclones (id, name, basin, position, category, forecast track), normalize, and cache the active-storm blob; reuse token-bucket + own-scheduler + graceful-skip (outage leaves the last set in place).
- [x] 2.3 Map each storm to threatened tracked countries by proximity of position + near-term track, with the open/resolve distance buffer (spatial hysteresis).
- [x] 2.4 Open/update/resolve `country:storm` incidents against the existing `incident` table (dedup `country:storm`, severity by category, name/category/position in `detail`); resolve when no active storm threatens the country. Confirm no `observation`/`score` rows are written.

## 3. API

- [x] 3.1 Add `GET /api/storms` to `services/api/main.py` returning the active-storm list + `ageMin` in one read-only, CORS-enabled response; empty list when none/warm-up; confirm `/api/tiles`,`/api/weather`,`/api/weather-field`,`/api/incidents` unchanged.

## 4. Frontend: data-backed spirals

- [x] 4.1 Add the storm payload type + a `fetchStorms` helper (in `data/`), fetched and held; fall back to the curated `STORMS` when absent/empty.
- [x] 4.2 Render live spirals in `globe/Globe.tsx` at real positions sized by category (optional forecast-track polyline), occlusion-correct, `reduceMotion`-aware.
- [x] 4.3 List the real active systems in `panels/OverlayPanel.tsx` (name + category), with the curated fallback; document real storm tracks + `country:storm` incidents on the methodology page.

## 5. Deployment

- [x] 5.1 Register `storm-worker` in `docker-compose.yml` and `docker/supervisord.conf` (both profiles, shared image, own command, egress only to NHC); update README/architecture docs.

## 6. Verification

- [x] 6.1 Confirm one worker cycle caches the active-storm set, an empty feed resolves storm incidents, and a provider outage leaves the last set in place (no crash); no `observation`/`score` rows written.
- [x] 6.2 Confirm a threatening storm opens exactly one `country:storm` incident with category-derived severity, a departing storm resolves it (spatial buffer prevents flapping), and the composite is unaffected.
- [x] 6.3 Confirm `GET /api/storms` serves the set (empty when none), the overlay renders live spirals at real positions and falls back to the decorative set without live data, and `reduceMotion` holds spirals static.
