## Why

Phase 2 (`add-weather-hazard-facets`) scored temperature, precipitation, and wind as per-country **point hazards** and deliberately deferred **cloud cover**, with a stated reason: cloud is a visual **field** quantity, not a per-country anomaly — "is Germany unusually cloudy" is not a z-score or an incident. The design roadmap named cloud's home: **Phase 3 — the 3D atmospheric field shell**.

This change delivers that shell. A coarse **global** atmospheric field (cloud cover, wind, precipitation) is fetched on a slow cadence, cached as one blob, and rendered as lifted shells/particles around the globe — giving the Meteorological overlay a real atmosphere and finally surfacing cloud cover, without forcing field data through the per-country scoring spine where it does not belong.

## What Changes

- **New `weather-field-worker` (new process).** A standalone worker fetches a coarse **global grid** of atmospheric field values from Open-Meteo (keyless) on a **slow cadence** (field data changes slowly and the grid is large): cloud cover %, 10 m wind (as U/V components for flow direction), and precipitation. It caches the latest grid as a **single blob** (in the DB as one row, or an equivalent single-object store) and overwrites it each cycle. Same keyless, token-bucketed, graceful-skip discipline as the other workers.
- **Field data bypasses the observation/scoring spine — by design.** The grid has **no country**, **no z-score**, and **no state**. It is NOT written to the `observation` store, NOT rolled into a domain, NOT scored, and NOT an incident source. It is a decorative/ambient visualization layer only. This is the core distinction from the Phase-2 point facets and the reason it is a separate capability.
- **New `GET /api/weather-field`.** Serves the cached field blob (grid metadata + packed values) in one response for the globe to render. Read-only, CORS-enabled, cache-friendly. `/api/tiles`, `/api/weather`, and `/api/incidents` are unaffected.
- **Atmospheric field-shell render (frontend).** The Meteorological overlay gains a **lifted field layer**: cloud cover drawn as translucent shells/particles floating above the globe surface (occlusion-correct, near-hemisphere only), optionally with wind-driven drift from the U/V components, respecting `reduceMotion`. **Cloud cover lands here** — the piece deferred from Phase 2. The existing temperature/precipitation/wind choropleth, its mode selector, and the storm spirals are unchanged and coexist with the shell.
- **New worker in the stack.** `weather-field-worker` is registered in Docker Compose (both profiles), preserving the local-first invariant (egress only to Open-Meteo).
- **No database migration of the scoring schema** — the field blob is a new, isolated store (its own table/row or cache), additive and independent of `observation`/`score`/`incident`.

## Capabilities

### New Capabilities
- `weather-field`: global atmospheric field ingestion and its data contract — a `weather-field-worker` fetches a coarse global grid (cloud %, wind U/V, precipitation) from Open-Meteo on a slow cadence and caches it as a single blob; the field has no country, no z-score, and no state, and does not flow through the observation store, scoring, or incidents.

### Modified Capabilities
- `api-service`: adds `GET /api/weather-field` serving the cached field blob in one response, leaving `/api/tiles`, `/api/weather`, and `/api/incidents` unaffected.
- `meteorological-overlay`: gains a lifted **atmospheric field-shell** render layer (cloud shells/particles, optionally wind-driven), where cloud cover is surfaced; the temperature/precipitation/wind choropleth and storm spirals are unchanged.
- `deployment-profiles`: the new `weather-field-worker` process is part of the stack in both profiles, keeping the single-host, upstream-only-egress invariant.

## Impact

- **Backend**: new `services/weather-field-worker/main.py` (batched global-grid fetch, blob cache, slow cadence, graceful skip). `services/common/config.py` (field grid resolution/extent, cadence, Open-Meteo field params, cache key). A single-blob store (new small table or cache) in `services/common/` + migration for that table (isolated from the scoring schema). `services/api/main.py` (`GET /api/weather-field`).
- **frontend**: `globe/Globe.tsx` (new lifted field-shell render layer + fetch/hold of the field blob), `panels/OverlayPanel.tsx` (optional field/cloud legend or toggle within the Meteorological panel), `data/` types + fetch for the field payload, `views/Methodology.tsx` (document the field shell: ambient/not-scored, cloud lives here).
- **Deployment**: `docker-compose.yml` gains a `weather-field-worker` service (both profiles); README/deploy docs updated.
- **Database**: additive — one new isolated table/row (or cache) for the field blob; no change to `observation`/`score`/`incident`.
- **External APIs**: none new — same keyless Open-Meteo, a different (grid) query on a slow cadence.
- **Out of scope**: **live storm tracks** (Phase 4 — the decorative spirals stay); any change to the temp/precip/wind **facet scoring**, incidents, hysteresis, or the worst-of composite; per-country cloud scoring (cloud is field-only, never a point hazard); animation of a full time-series (single latest snapshot in v1).

## Depends On
- None active. Builds on the archived `add-weather-domain` and the completed `add-weather-hazard-facets` (temp/precip/wind facets, `/api/weather`, the mode-switchable overlay). Independent of those internals — it adds a parallel field layer and never touches the scoring spine.
