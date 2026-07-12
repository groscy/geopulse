## Why

Phase 1 shipped five **hardcoded, decorative** storm spirals (`STORMS` in `data/overlays.ts`) and reserved an incident seam (`INCIDENT_DOMAINS`) for making them real. Phase 4 delivers that: a keyless `storm-worker` fetches **active tropical-cyclone** positions, category, and forecast track, the globe renders each cyclone where it actually is, and each opens a `country:storm` incident. This is the last piece that turns the Meteorological overlay from "data-backed choropleth + decorative spirals" into a fully live weather layer.

## What Changes

- **New `storm-worker` (keyless, new process).** Fetches currently-active tropical cyclones from NOAA's National Hurricane Center feed (`CurrentStorms.json`, Atlantic + East Pacific) on a slow cadence — per storm: id, name, basin, current position, Saffir-Simpson category / intensity, and the forecast track points. Same token-bucket + own-scheduler + graceful-skip discipline as the other workers. (Non-NHC basins — JTWC West-Pacific / Indian Ocean — are a documented follow-up.)
- **Storm feature store (isolated).** The active-storm list is cached as a single blob in its own `storm` store, overwritten each cycle. Like the atmospheric field, storm data is **feature data with no per-country z-score** and does not enter the `observation`/`score` spine — but unlike the field, it **does** open incidents (mapped to affected countries).
- **`GET /api/storms`.** Serves the active storms (position, category, name, track) in one response so the globe renders real spirals and the panel lists real systems, replacing the hardcoded constant.
- **Storm → country incidents.** Each active storm is mapped to the tracked country/countries it threatens (proximity of its position + near-term track to country points); the worker opens a `country:storm` incident (severity from category) via the existing incident schema, dedup, and resolution, and resolves it when the storm dissipates or moves clearly offshore. Reuses the `INCIDENT_DOMAINS` seam and `/api/incidents` unchanged.
- **Frontend: spirals become data-backed.** `Globe.tsx` renders spirals at real positions sized by category (optionally the forecast track/cone); `OverlayPanel.tsx` lists the real active storms; `data/overlays.ts` `STORMS` becomes a fixtures/demo fallback only (no live data → current decorative behavior).
- **New worker in the stack.** `storm-worker` registered in Compose + supervisord (both profiles), egress only to the NHC feed.

## Capabilities

### New Capabilities
- `storm-tracks`: active tropical-cyclone ingestion and its data contract — a `storm-worker` fetches active cyclones (position, category, forecast track) from a keyless source, caches them as one blob (feature data, no per-country z-score), and maps each storm to the tracked countries it threatens.

### Modified Capabilities
- `api-service`: adds `GET /api/storms` serving the active-storm list; `/api/tiles`, `/api/weather`, `/api/weather-field`, and `/api/incidents` are unaffected.
- `meteorological-overlay`: the storm spirals become **data-backed** (real positions, category-scaled, with optional forecast track), and the panel lists the real active systems; falls back to the decorative curated set when no live storm data is available.
- `incident-detection`: active cyclones open `country:storm` incidents (severity by Saffir-Simpson category) mapped to threatened countries, reusing the incident schema, dedup, and resolution; resolved when the storm dissipates or clears the country.
- `deployment-profiles`: the new `storm-worker` process runs in both profiles, egress only to the NHC feed, preserving the local-first invariant.

## Impact

- **Backend**: new `services/storm-worker/main.py` (fetch active cyclones, cache blob, map storms→countries, open/resolve `country:storm` incidents). `services/common/config.py` (NHC feed URL, cadence, proximity threshold, category→severity map). A `storm` blob store + migration (isolated from `observation`/`score`). `services/api/main.py` (`GET /api/storms`).
- **frontend**: `globe/Globe.tsx` (data-backed spirals + optional track), `panels/OverlayPanel.tsx` (real active-storm list), `data/overlays.ts` + types + fetch (fallback path), `views/Methodology.tsx` (document real storm tracks + `country:storm` incidents).
- **Deployment**: `docker-compose.yml` + `docker/supervisord.conf` gain a `storm-worker` service; README/architecture updated.
- **Database**: additive — one isolated `storm` blob table; no change to `observation`/`score`. `incident` rows gain `country:storm` dedup keys (existing schema).
- **External APIs**: NOAA NHC `CurrentStorms.json` (keyless). No key required.
- **Out of scope**: non-NHC basins (JTWC West-Pacific / Indian Ocean) — v1 is NHC (Atlantic + East Pacific) coverage; historical track playback; scoring storms as a z-scored domain (they are incidents, not a composite vote); cone-polygon landfall geometry (v1 uses proximity).

## Depends On
- None active. Builds on the archived `add-weather-domain` (the `INCIDENT_DOMAINS` seam, decorative `STORMS`) and the completed `add-weather-field-shell` (the isolated-feature-store pattern). Independent of the other queued weather changes.
