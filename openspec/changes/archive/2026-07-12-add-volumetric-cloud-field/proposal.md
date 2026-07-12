## Why

Phase 3 shipped the atmospheric field as a **cloud shell**, and a follow-up polish broke up the grid so it reads as scattered cloud masses. But it is still a scatter of soft sprite puffs on a coarse 15° grid — legible, not continuous or photoreal. This change upgrades the shell to a **continuous, volumetric-looking** cloud layer, and picks up the deferred Phase-3 field fast-follows: a **finer grid**, a **packed columnar payload** (so the finer grid stays cheap over the wire), and **precipitation surfaced** in the field for drizzle/streak hints.

## What Changes

- **Continuous cloud render (replaces sprite puffs).** Instead of one puff per node, the overlay **interpolates** the cloud field between nodes and renders it as a soft, multi-octave-noise-modulated cloud mass — an offscreen cloud-density texture composited over the near hemisphere, occlusion-correct and `reduceMotion`-aware — so clouds read as continuous banks rather than discrete blobs. (Canvas-2D approach; a WebGL/shader path is noted as a later option.)
- **Finer field grid.** Reduce the field step (config) for more spatial detail; the interpolation + finer grid give genuinely continuous coverage.
- **Packed columnar payload.** `GET /api/weather-field` returns the grid as **dimensions + flat typed arrays** (`cloud`/`u`/`v`/`precip`) rather than an array of per-node objects, so the finer grid stays small; the client decodes to the same field it renders. The array-of-cells form remains acceptable for a coarse grid, but the packed form is the default at fine resolution.
- **Precipitation in the render.** The field's `precip` channel (already fetched, previously unused in render) drives optional drizzle/streak emphasis where precipitation is high.

## Capabilities

### Modified Capabilities
- `meteorological-overlay`: the atmospheric field shell becomes a **continuous volumetric cloud** render (interpolated + noise-modulated), replacing the discrete sprite puffs, with optional precipitation emphasis; occlusion, near-hemisphere clipping, and `reduceMotion` behavior are preserved.
- `weather-field`: the grid may be **finer** (smaller step) and is serialized in a **packed columnar** form; the `precip` channel is available to the render.
- `api-service`: `GET /api/weather-field` serves the packed columnar payload (dimensions + flat arrays) for the finer grid, with the field age, in one response.

## Impact

- **backend**: `services/common/config.py` (finer `WEATHER_FIELD_STEP`, packed-payload flag). `services/weather-field-worker/main.py` (finer grid = more batched calls; emit the columnar blob). `services/api/main.py` (`/api/weather-field` packed encoding).
- **frontend**: `globe/Globe.tsx` (the continuous cloud-texture render — offscreen density accumulation + noise + occluded composite + optional precip streaks; throttled rebuild for perf), `data/apiSource.ts` + `data/types.ts` (decode the packed payload; field sampling/interpolation helpers), `panels/OverlayPanel.tsx` (legend copy if needed), `views/Methodology.tsx` (note the continuous field render).
- **Database**: none — the field is still one cached blob (now columnar).
- **External APIs**: none new — same keyless Open-Meteo, a finer grid on the same slow cadence.
- **Out of scope**: a full WebGL/GPU volumetric renderer (noted as a later option — this change stays canvas-2D); true 3D raymarched clouds; time-series/animated forecast playback; storms (separate change).

## Depends On
- None active. Builds directly on the completed `add-weather-field-shell` (the field worker, `/api/weather-field`, and the sprite-puff shell this replaces). Independent of the other queued weather changes.
