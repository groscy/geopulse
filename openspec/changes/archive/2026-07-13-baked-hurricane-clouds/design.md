# Design — baked-hurricane-clouds

## Context

The atmospheric field already renders as a GPU-raymarched volumetric cloud shell (`frontend/src/globe/clouds-gl/index.ts`, change `add-raymarched-clouds`): a WebGL2 fragment shader marches a thin shell (`r ∈ [1.0, 1.05]`) over the near hemisphere of the D3-orthographic globe, taking **coverage** from the weather field (an equirectangular `sampler2D`) and **volume** from baked worley-perlin 3D noise (`sampler3D`), lit from the sub-solar point (Beer-Powder + Henyey-Greenstein). The result is composited into the 2D globe as an `ImageBitmap` at the cloud-draw point, preserving paint order.

Storms, by contrast, are still drawn as an abstract **2-arm line spiral** on the 2D canvas (`Globe.tsx` ~L465–495): for each live cyclone (`fetchStorms`, real position/category/track) or the curated `STORMS` fallback, a rotating logarithmic spiral of two arms plus a center dot, sized by category, with a dashed forecast track. It reads as a schematic marker, not weather.

This change renders each cyclone as a **baked volumetric hurricane cloud** on the *same* raymarch shell, so the most dramatic weather looks like weather. The mechanism deliberately mirrors the shell's existing split: **coverage from a baked hurricane stamp, volume from the existing baked noise** — the exact analog of "coverage from the field, volume from baked noise".

Constraints inherited from the shell: orthographic parallel rays (analytic shell entry/exit), 60 fps globe budget (bounded ray + light steps, re-render only on camera/time change), `reduceMotion`, and a WebGL2-unavailable fallback path.

## Goals / Non-Goals

**Goals:**
- Render live/decorative cyclones as sun-lit volumetric hurricane clouds — spiral rain bands, a dense eyewall ring, a clear eye — standing over the globe and the limb.
- Reuse the existing raymarch, noise, and lighting; add a storm contribution to coverage rather than a second renderer.
- Scale each system by Saffir-Simpson category; wind bands with hemisphere-correct chirality; rotate under animation, freeze under `reduceMotion`.
- Keep the forecast track, numeric labels, active-storms panel, and paint order unchanged; keep the 2D line spiral as the no-WebGL2 fallback.
- Stay within the 60 fps budget: bounded per-storm cost, capped storm count, re-render only on camera/time/storm change.

**Non-Goals:**
- Per-storm bespoke cloud shapes (one shared baked template, category-scaled).
- Coupling the cyclone to precip/wind channels, storm surge, or a volumetric forecast cone.
- Porting the forecast track or panel to the GPU; animating intensity over forecast time.
- Any change to `/api/storms`, the storm data model, or the curated decorative set.

## Decisions

### 1. Inject a baked hurricane stamp into shell coverage (not a separate renderer, not a per-storm dome)
The shader already marches world positions and, per sample, reads `coverage(lon, lat)` before carving with 3D noise (`sampleDensity`, index.ts L100–112). We add a `stormCoverage(dir)` term folded into `coverage()` so a cyclone becomes **structured coverage** that the *existing* base/detail noise turns into billowy cloud and the *existing* lighting lights. No second raymarch pass, no per-storm local shell, no new lighting.

- **Alternative — bake a full 3D hurricane volume and raymarch a local dome per storm.** More physically faithful (true 3D eyewall/anvil), but needs per-storm placement/orientation math, extra passes, and a second compositing path. Rejected as disproportionate; the thin shell + noise already sells volume.
- **Alternative — keep it fully procedural in the shader (no bake).** Possible, but the request is explicitly *baked* hurricane clouds, and a baked template keeps the analytic spiral, eyewall, and height profile out of the per-fragment inner loop and consistent with `bake-cloud-noise.mjs`. Chosen: bake.

### 2. Baked template = a compact polar RGBA texture
`frontend/scripts/bake-hurricane-cloud.mjs` (mirroring `bake-cloud-noise.mjs`: deterministic integer hash, no `Math.random`, committed output) emits `hurricane-cloud.bin` next to the GL renderer — a **polar** map indexed by `(angle θ, normalized radius r)`, uploaded as a `sampler2D` with `WRAP_S = REPEAT` (angle wraps seamlessly) and `WRAP_T = CLAMP_TO_EDGE` (radius). Channels:
- **R — band/eyewall density**: log-spiral arms `sin(k·log(r) − armCount·θ)` gated by a radial envelope, plus a bright eyewall ring near `r ≈ r_eye`, plus a small periodic worley jitter so arms aren't perfectly regular. Zero at the eye (`r < r_eye`) and faded to zero at the outer edge (`r → 1`).
- **G — height multiplier**: tall at the eyewall, tapering outward — feeds the shell's vertical `heightProfile` so the eyewall stands taller than outer bands.
- **B/A — spare** (reserved; e.g. an eye-mask or precip hint for a follow-up).

Size ~256×256 RGBA8 ≈ 256 KB (loaded once at GL init, well inside the frontend budget). Angle is periodic in the bake so there is no seam at `θ = 0`.

### 3. Storm-local coordinates from the world direction the shader already has
Per marched sample the shader computes `dir = wp / rad` (unit world position, L139). For each storm with world-space center unit vector `c` (from lon/lat) we compute, entirely from `dir` and `c`:
- **angular distance** `ρ = acos(dot(dir, c))`; **normalized radius** `r = ρ / ρ_max`, where `ρ_max` (the system's outer extent) scales with category.
- **bearing** `θ = atan2(dot(dir, e), dot(dir, n))` in the tangent frame at `c` (`e = normalize(cross(zAxis, c))` east, `n = cross(c, e)` north). Rotation and chirality apply as `θ' = spin · (θ + phase)`, `spin = +1` north / `−1` south, `phase = animate ? time·ω : 0`.
- sample `hurricane-cloud` at `(θ' / 2π, r)`, scale by a category density factor, and **add** to field coverage, then `clamp(…, 0, 1)`. Adding (not replacing) means a cyclone over already-cloudy field reads as intensified, structured cloud.

Early-out when `dot(dir, c) < cos(ρ_max)` (sample outside the system) keeps the added cost near zero away from storms.

### 4. Per-storm uniforms, capped count, uploaded like the field
`CloudGL` gains `setStorms(storms)` (parallel to `setField`): packs up to `MAX_STORMS` (e.g. 8) into uniform arrays — `uStormPos[]` (world vec3), `uStormRadius[]`/`uStormDensity[]` (category-scaled), `uStormSpin[]` (±1), `uStormPhaseBase[]` — plus `uStormCount`. `Globe.tsx` passes the same list it uses today (live `storms.current` mapped by category/hemisphere, else curated `STORMS`) into `cloudGL.setStorms(...)` each frame before `render(...)`. The render cache key (`cloudKey`, L514) gains a storm signature (positions + categories + motion bucket) so the shell re-raymarches when storms move or the phase advances, and reuses the cached bitmap otherwise.

### 5. The 2D line spiral stays, behind the fallback
The existing storm-spiral block in `Globe.tsx` is kept but drawn **only** when the GPU cloud path is not active (`!useGpu` / `CLOUD_MODE === 'off'` / context lost) — exactly how the canvas-2D cloud texture is retained as the raymarch fallback. When the GPU path is active, storms are rendered by the shell and the 2D spiral is skipped; the **forecast track** (dashed) and the numeric labels/panel are drawn in both paths, above the cloud, unchanged.

## Risks / Trade-offs

- **Per-fragment cost scales with storm count** → cap at `MAX_STORMS` (≈8, more than are ever simultaneously active/visible) and early-out by `dot(dir, c)` before the polar math / texture fetch, so off-storm fragments pay ~one dot product per storm. Log any storms dropped beyond the cap.
- **Thin shell can't express a full 3D eyewall/anvil** → accept; the shell + G-channel height multiplier + noise already read as a raised, banded, eyed system. A true 3D volume is a deferred follow-up (Decision 1 alternative).
- **Coverage addition can saturate** over already-cloudy field → clamp to 1.0; tune the category density factor so a Cat-5 reads intense but the eye still punches a clean hole (template R = 0 inside `r_eye`).
- **Great-circle math per sample per storm** (`acos`, `atan2`) → only reached inside the early-out radius; the STEPS×storms worst case is bounded and confined to fragments actually over a storm.
- **Eye must stay clean under noise erosion** → the eye is a hard zero in the template *and* the height multiplier, so `sampleDensity`'s noise multiply keeps it empty rather than filling it with wisps.
- **Chirality/rotation regressions** → covered by spec scenarios (hemisphere chirality, `reduceMotion` freeze); verify against the current 2D-spiral spin sign (`s.lat >= 0 ? 1 : -1`).
- **Fallback drift** → the 2D spiral path is unchanged code, only gated; if the GPU path regresses, the fallback still renders storms.

## Migration Plan

1. Add `bake-hurricane-cloud.mjs`; run once; commit `hurricane-cloud.bin`.
2. Extend `CloudGL`: load the template sampler, add storm uniforms + `setStorms()`, add `stormCoverage()`/`coverage()` fold in the shader.
3. Wire `Globe.tsx`: call `setStorms(...)` each frame, extend the render cache key, gate the 2D-spiral block behind the fallback, keep track/labels/panel.
4. Note the render in `views/Methodology.tsx`.
- **Rollback:** revert the `Globe.tsx` gating so the 2D spiral always draws; the shell change is inert without `setStorms`. No data/back-end migration (same `/api/storms`).

## Open Questions

- Final `MAX_STORMS` and the category→(`ρ_max`, density, band-count) curve — pick against real `/api/storms` payloads during implementation.
- Rotation rate `ω`: match the current 2D spiral feel (`time * 0.7`) or slow it for realism.
- Whether to also nudge the field's wind advection around the eye (deferred; not required for the look).
