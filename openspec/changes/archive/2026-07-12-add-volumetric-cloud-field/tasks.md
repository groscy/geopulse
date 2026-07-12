## 1. Field resolution + packed payload

- [x] 1.1 Add a finer `WEATHER_FIELD_STEP` default + a packed-payload flag in `services/common/config.py`; confirm the batching/node-cap in `weather-field-worker` handles the denser grid on the slow cadence.
- [x] 1.2 Emit / serve the field in **packed columnar** form (dims + flat `cloud`/`u`/`v`/`precip` arrays): worker caches the columnar blob; `GET /api/weather-field` serves it (keep the per-node form valid for coarse grids); empty before warm-up.

## 2. Frontend: continuous cloud render

- [x] 2.1 Decode the packed field in `data/apiSource.ts` + types; add grid **bilinear sampling/interpolation** helpers (cloud + wind) reconstructing node positions from `(latMin, step, dims)`.
- [x] 2.2 Replace the sprite-puff shell in `globe/Globe.tsx` with a **continuous cloud render**: an offscreen low-res density texture (interpolated cloud × multi-octave noise), composited over the near hemisphere with limb fade + occlusion; keep the sprite path as a fallback.
- [x] 2.3 Make it performance-bounded: rebuild the offscreen texture on a throttle (every N frames / on rotation-delta) and cache it between rebuilds; advect the noise along interpolated wind only when animating (`reduceMotion` → static).
- [x] 2.4 Add optional precipitation emphasis (subtle streak/darkening where interpolated `precip` is high); update the methodology note to describe the continuous field render.

## 3. Verification

- [x] 3.1 Confirm the worker/endpoint serve the finer packed grid (dims + flat arrays), the client reconstructs the same field, and other endpoints are unchanged.
- [x] 3.2 Confirm clouds render as continuous interpolated masses (not puffs), stay occlusion-correct and limb-faded, hold static under `reduceMotion`, keep drag/rotate smooth (throttled rebuild), and show an honest empty state without field data.
