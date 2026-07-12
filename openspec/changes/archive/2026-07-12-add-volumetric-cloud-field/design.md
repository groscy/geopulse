## Context

The atmospheric field (`add-weather-field-shell`) fetches a coarse global grid of `{cloud, u, v, precip}` and renders cloud as one soft sprite puff per node, drawn on the existing **canvas-2D** globe (D3-geo orthographic, no WebGL). A polish pass jittered/varied the puffs, but the underlying coarse grid and discrete-sprite approach cap how continuous it can look. The data and the fetch/store/endpoint are sound; this change is a **render + resolution + wire-format** upgrade, not a new data path.

## Goals / Non-Goals

**Goals:**
- Make clouds read as **continuous banks** — interpolated between nodes and modulated by noise — rather than discrete puffs.
- Raise spatial resolution (finer grid) without blowing up the payload (packed columnar) or the frame budget (throttled texture rebuild).
- Preserve everything that already works: occlusion, near-hemisphere clipping, `reduceMotion`, coexistence with the choropleth/labels/storms, and the honest empty state.

**Non-Goals:**
- No WebGL/GPU renderer in v1 (noted as a later option); stays canvas-2D so it drops into the existing globe.
- No 3D raymarched volumetrics or forecast-time animation.
- No change to the field's ingestion semantics (still one cached blob, slow cadence, isolated from scoring).

## Decisions

- **Offscreen cloud-density texture, composited with occlusion.** Each render (throttled — see perf) builds a low-res **offscreen** canvas where the interpolated cloud field is accumulated and multiplied by 2–3 octaves of value noise, then composited over the globe: sampled per screen-pixel of the near hemisphere, masked to the sphere disc, and faded at the limb. This yields soft continuous masses from the same grid. Rationale: gets "volumetric-looking" clouds within canvas-2D, reusing the existing occlusion/limb math; no new rendering stack. *Alternative rejected:* many more sprite puffs — still discrete, and cheaper only until it isn't; a WebGL shell — a much bigger dependency/rewrite, deferred.

- **Throttle the texture rebuild; cache between rebuilds.** The offscreen density texture is rebuilt at a reduced cadence (every N frames, or when rotation/zoom moves past a threshold) and cached; intermediate frames re-composite the cached texture (cheap). When `reduceMotion` is on, the noise is static; when animating, the noise phase advects slowly along the field's `(u, v)` so clouds drift. Rationale: a per-frame full rebuild is the perf risk on canvas-2D; decoupling rebuild-rate from frame-rate keeps it smooth. *Alternative rejected:* rebuild every frame — needless cost; the field is quasi-static between fetches.

- **Finer grid, paid for by a packed payload.** Drop the step (e.g. 15° → ~8–10°), raising node count several-fold. To keep the wire small, `/api/weather-field` serializes **dimensions + flat typed arrays** (`cloud`, `u`, `v`, `precip`) instead of an array of `{lat,lon,...}` objects; the client reconstructs node positions from `(latMin, step, dims)` and interpolates. Rationale: a columnar payload is far smaller and faster to decode at fine resolution; interpolation wants a regular grid anyway. Backward-friendly: the coarse array-of-cells form still validates for small grids. *Alternative rejected:* finer grid with the object-array payload — payload bloats and parsing costs rise.

- **Bilinear field sampling drives both color and noise.** Cloud density at a screen point is the bilinear interpolation of the four surrounding grid nodes' cloud %, then noise-modulated; wind `(u,v)` is interpolated the same way for drift. Rationale: continuity comes from interpolation; noise adds the organic texture. 

- **Precip as a secondary emphasis.** Where interpolated `precip` is high, add a subtle darker/streaky modulation under the cloud (drizzle hint), gated the same as clouds. Rationale: uses the already-fetched channel; optional and subtle so it never competes with the choropleth. *Alternative rejected:* a full precip render mode — out of scope; this is a hint.

## Risks / Trade-offs

- **Canvas-2D per-pixel compositing is the perf risk.** → Low-res offscreen texture (upscaled on composite), throttled rebuild, cached between rebuilds, resolution cap; measure and back off. If it can't hit budget, fall back to the (retained) dense-sprite path.
- **Finer grid → more Open-Meteo calls per cycle.** → Same slow cadence + batching + node cap; the cost is a handful more requests every few hours.
- **Noise clouds can look artificial if overdone.** → Density is driven by the *real* field; noise only textures it; keep amplitude/opacity subtle and tunable.
- **Payload format change.** → Client decodes the packed form; the coarse object-array form remains valid, so the two coexist during rollout.

## Migration Plan

Additive, reversible. (1) `/api/weather-field` gains the packed columnar encoding (behind a finer default grid). (2) Worker emits the finer/columnar blob. (3) Frontend decodes the packed field, adds the interpolation + offscreen cloud-texture render (throttled), retiring the sprite-puff path (kept as a fallback). (4) Methodology note. **Rollback:** revert the grid step and the render to the sprite-puff shell and the object-array payload — the field worker, store, and everything downstream of the field are otherwise unchanged.

## Open Questions (resolved with v1 defaults)

- **WebGL or canvas-2D?** → **Canvas-2D** with an offscreen density texture for v1; WebGL is a later option if the budget demands it.
- **How fine a grid?** → ~8–10° default (config), paid for by the packed payload; tune against perf.
- **Packed or object payload?** → **Packed columnar** default at fine resolution; object-array stays valid for coarse grids.
- **Animate the clouds?** → Static under `reduceMotion`; otherwise slow noise advection along interpolated wind.
