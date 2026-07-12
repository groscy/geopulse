## Context

GeoPulse's spine is per-country scalars → self-relative z → four-state domains → hysteresis → worst-of composite → incidents. Phases 1–2 fit weather into that spine as **point** signals sampled at each capital: temperature (two-sided), precipitation (`log1p`, flood-only), wind (one-sided max). Phase 2's design.md explicitly deferred **cloud cover** because it does not fit the spine — cloud is not a per-country hazard you z-score; it is an ambient **field** that covers oceans and poles as much as capitals, and its value is *visual context*, not risk state.

Phase 3 builds the home the roadmap named: a **3D atmospheric field shell**. Field data is categorically different from the observation store — it has **no country, no baseline, no z, no state**. So the right shape is a parallel, isolated pipeline (worker → blob cache → endpoint → lifted render), touching none of the scoring code. Open-Meteo (keyless) already serves cloud, wind, and precipitation at arbitrary coordinates, so the same provider and the same worker discipline (token bucket, graceful skip, own scheduler) carry over.

## Goals / Non-Goals

**Goals:**
- Render a global ambient atmosphere around the globe — cloud cover as lifted shells/particles, optionally wind-driven — surfacing the cloud layer deferred from Phase 2.
- Keep field data **completely decoupled** from the scoring spine: no `observation`/`score`/`incident` rows, no domain, no composite effect.
- One keyless, slow-cadence fetch → one cached blob → one endpoint → one render layer, reusing existing worker/DB/api conventions.
- Degrade gracefully: a stalled field worker leaves the last grid in place (the shell goes stale/static, never blank or broken), exactly like the point workers.

**Non-Goals (v1):**
- No per-country cloud scoring, cloud anomaly, or cloud incidents — cloud is field-only.
- No **live storm tracks** — Phase 4; the decorative spirals stay.
- No time-series animation of the field — a single latest snapshot (plus optional wind-driven drift of that snapshot); no historical playback.
- No change to the temp/precip/wind facets, their incidents/hysteresis, or the worst-of composite.
- No high-resolution grid or GRIB — a coarse decorative grid is enough.

## Decisions

- **A separate `weather-field` capability with an isolated blob store (not the observation store).** The grid is written to its own single-row store (a new `weather_field` table, or an equivalent cache), overwritten each cycle, keyed by a constant. Rationale: field data has no country and no z — forcing it into `observation` would break that table's per-country contract and leak non-scored rows into scoring queries. An isolated blob keeps the spine clean and makes the whole feature additive and trivially reversible (drop one table). *Alternative rejected:* reuse `observation` with a sentinel country — pollutes every `SELECT DISTINCT country` in scoring/api.

- **Coarse global grid via batched Open-Meteo `current` call(s).** Generate grid nodes at a configurable spacing (default ~15°, ~300 nodes over the populated/visible band, e.g. lat −60…75), fetched with the same comma-separated multi-coordinate `current=` request the point worker already uses, split into a few batched calls if the coordinate count exceeds the provider's per-request limit. Rationale: it is ambient decoration, not precision meteorology; a coarse grid keeps it to one/few calls on a slow cadence, well within the keyless quota. *Alternative rejected:* a fine grid or a dedicated gridded/GRIB endpoint — needless payload, quota, and render cost for a decorative layer.

- **Slow cadence, single-blob overwrite.** The worker runs on a slow interval (default a few hours — field state drifts slowly and the grid is large) and overwrites the one cached blob each cycle with a fresh `ts`. Rationale: matches how fast the data actually changes and minimizes provider load and storage. *Alternative rejected:* per-node history rows — unnecessary; only the latest snapshot is rendered.

- **Wind stored as U/V components, not just speed.** The worker requests `cloud_cover`, `wind_speed_10m`, `wind_direction_10m`, `precipitation` and derives `u = −speed·sin(dir)`, `v = −speed·cos(dir)` (meteorological convention) per node. Rationale: the shell can render **flow direction** (drift/streamlines), which speed alone cannot express; deriving once at ingest keeps the client simple. *Alternative rejected:* store speed+direction and trig on the client every frame.

- **`GET /api/weather-field` returns the whole grid in one response.** Grid metadata (`step`, extent, dims, `ts`, `ageMin`) plus per-node `{lat, lon, cloud, u, v, precip}` (a packed columnar form is a documented fast-follow if the payload grows). Read-only, CORS-enabled, cache-friendly; the client fetches once and re-renders from the held blob. Rationale: one request, no per-frame fetching; mirrors `/api/weather`'s "hold all facets, switch client-side" pattern. `/api/tiles`, `/api/weather`, `/api/incidents` are untouched.

- **Lifted, occlusion-correct render that coexists with the choropleth.** Cloud is drawn as translucent shells/particles at grid nodes **lifted** above the sphere (altitude factor, like the satellite shells and arcs), alpha scaled by cloud %, clipped to the near, visible hemisphere (far-side nodes and nodes behind the globe are culled — reuse the existing `lift`/occlusion helpers in `Globe.tsx`). Optional wind-driven drift advects particles along `(u,v)`; `reduceMotion` holds them static. The temperature/precip/wind choropleth, storm spirals, and numeric labels are unchanged and render underneath. Rationale: reuses the globe's proven lift/occlusion math; keeps the atmosphere visually above the surface data instead of competing with it. *Alternative rejected:* a flat cloud choropleth mode — that is a surface tint, not an atmosphere, and duplicates the choropleth pattern rather than adding the promised shell.

- **New `weather-field-worker` process in both Compose profiles.** Registered like the other workers (`geopulse/services:local` image, own command, `env_file`, restart policy), egress only to Open-Meteo. Rationale: it is a long-running scheduled job like every other worker; the local-first, upstream-only-egress invariant is preserved.

## Risks / Trade-offs

- **Open-Meteo coordinate-count / URL-length limits per request.** → Keep the grid coarse and, if needed, split one cycle into a small number of batched calls; the slow cadence keeps total calls tiny. Node count is capped by config.
- **Payload size / render cost with many nodes.** → Coarse default grid (~300 nodes); cull to the near hemisphere before drawing; a packed columnar payload encoding is a documented fast-follow if a finer grid is ever wanted.
- **Visual clutter over the choropleth.** → Cloud shells are subtle (low alpha, lifted above the surface); the layer can be tuned or gated behind a small sub-control in the Meteorological panel so it never overwhelms the temperature/precip/wind read.
- **Field staleness if the worker stalls.** → The endpoint serves the last blob with `ts`/`ageMin`; the shell simply ages (and goes static), never blocks or blanks — same graceful-degradation contract as the point workers.
- **Pole/ocean nodes and projection distortion near ±90° lat.** → Clamp the grid's latitude band (e.g. −60…75) so nodes stay where the orthographic projection is well-behaved and where the atmosphere reads clearly.

## Migration Plan

Additive and reversible. (1) Add the isolated `weather_field` blob table via the existing migration path. (2) Add `services/weather-field-worker/main.py` + config (grid extent/step, cadence, field params) and register it in Compose (both profiles). (3) Add `GET /api/weather-field`. (4) Frontend: fetch/hold the field blob and add the lifted shell render layer to the Meteorological overlay; document it on the methodology page (ambient, not scored; cloud lives here). **Rollback:** stop the worker, drop the endpoint, hide the render layer, drop the `weather_field` table — the scoring spine, the point facets, `/api/weather`, and the composite are entirely unaffected because the field never touched them.

## Open Questions (resolved with v1 defaults)

- **Grid resolution?** → Coarse, configurable; default ~15° over a clamped latitude band (~300 nodes). Finer is a config bump later.
- **Wind drift in v1, or static cloud only?** → Ship **static cloud shells** as the baseline; wind-driven drift is a thin optional enhancement gated by `reduceMotion`.
- **Always-on with the overlay, or a sub-toggle?** → Render the shell as part of the Meteorological overlay; if it competes visually with the choropleth, add a small cloud sub-toggle in the panel (cheap, contained to that panel).
- **Precip in the field payload?** → Included in the grid for future use (drizzle/streak effects), but v1 renders cloud (and optionally wind); precip-field rendering is a fast-follow.
