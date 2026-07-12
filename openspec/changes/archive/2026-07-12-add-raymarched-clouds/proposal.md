## Why

`add-volumetric-cloud-field` shipped a **continuous** cloud layer, but it is still a **flat** canvas-2D texture: an offscreen density map (interpolated field × value noise) composited onto the sphere disc with a limb fade. It reads as continuous, not as *volume* — there is no light vector in it, no cast shadow, no height, and it is clipped hard at the globe's edge, so clouds can never stand up over the horizon. This change moves the cloud render onto the **GPU (WebGL2)**: a raymarched volumetric cloud shell whose **coverage** comes from the existing weather field (the "where") and whose **volume** comes from baked worley-perlin 3D noise (the "how it looks"), lit by the already-computed sun. The canvas-2D render is retained as a feature-detected fallback.

## What Changes

- **GPU raymarched cloud shell (replaces the flat texture).** A WebGL2 fragment shader raymarches a thin shell (`r ∈ [1.0, 1.05]`) over the near hemisphere. Because D3's projection is **orthographic**, all eye rays are parallel and the shell entry/exit is analytic — a short, bounded march per pixel. The planet's front cap hides the far hemisphere; the **limb annulus** (`1 ≤ r_screen ≤ 1.05`) renders clouds curving up over the horizon against space — the shot the flat texture cannot produce.
- **Coverage from the field, volume from baked noise.** The existing weather field is uploaded as an **equirectangular coverage `sampler2D`** (the placement mask, exactly as today's texture approximates). A baked **worley-perlin 3D noise** volume (`sampler3D`, base 64³ RGBA + detail 32³) carves the actual cloud form: `base × coverage`, edge-eroded by detail noise, shaped by a vertical height profile (rounded base, wispy top).
- **Sun-lit, wind-advected.** Lit from the sub-solar point already computed for the day/night overlay (lifted out of that block), with Beer-Powder extinction and a Henyey-Greenstein forward-scatter term for the silver lining. Noise advects along the field's `u/v`; frozen under `reduceMotion`.
- **Composited into the existing 2D globe (spike approach).** The half-res GL buffer is composited into the existing 2D canvas at the current cloud-draw point (`OffscreenCanvas.transferToImageBitmap()` → `drawImage`), preserving the paint order — clouds over land, labels/storms/arcs still on top. A 3-canvas stack is noted as a later option if the per-frame blit costs too much.
- **Baked offscreen (not Blender), committed as an asset.** The worley-perlin volume is produced by a small deterministic **bake script** (periodic noise, channel-packed RGBA `.bin`), run once and committed. Blender is not used for this asset (periodicity + channel packing are cleaner in a purpose-built bake).
- **Canvas-2D fallback retained.** `CLOUD_VOLUMETRIC` becomes a three-way selector (`gpu | canvas | off`); when WebGL2 is unavailable or the context is lost, the existing continuous canvas-2D render draws instead.

## Capabilities

### Modified Capabilities
- `meteorological-overlay`: the atmospheric field's continuous cloud render becomes a **GPU-raymarched volumetric shell** (coverage from the field, volume from baked 3D noise, sun-lit), replacing the flat canvas-2D texture; occlusion, limb behavior, `reduceMotion`, the honest empty state, and non-interference with the choropleth/storms/labels are preserved, and a canvas-2D fallback is retained.

## Impact

- **frontend**: new `globe/clouds-gl/` (WebGL2 context, fullscreen-quad raymarch shader, texture uploads, camera uniforms replicating `d3.geoRotation`); `globe/Globe.tsx` (feature-detect + init the GL layer, drive per-frame uniforms from the existing rotation/zoom/sun/field, composite the GL buffer at the current cloud-draw point, keep the canvas-2D path behind the fallback); `views/Methodology.tsx` (note the GPU render). A small **noise-bake script** (offline, committed) plus its baked `.bin` asset(s).
- **backend**: none — same `/api/weather-field`, same field payload. The field is re-purposed as the coverage texture client-side; no worker/endpoint/db change.
- **assets**: one baked worley-perlin volume (~1.1 MB total: base 64³ RGBA + detail 32³), loaded once at GL init.
- **External APIs**: none.
- **Out of scope**: porting the rest of the globe (land/choropleth/arcs/labels) to WebGL — this stays a **clouds-only** GL layer over the 2D globe; the 3-canvas compositing refactor (kept as a later option); Blender-baked art-directed cloud *shapes* (a possible follow-up); animated forecast-time playback; storms (separate change, unchanged).

## Depends On
- `add-volumetric-cloud-field` (complete, pending archive). This change **supersedes its render** — it modifies the `Continuous cloud field render` requirement that change introduced, and keeps that canvas-2D render as the fallback. It should archive before or with this change so the modified requirement resolves against a baseline that contains it. No dependency on the other queued weather changes.
