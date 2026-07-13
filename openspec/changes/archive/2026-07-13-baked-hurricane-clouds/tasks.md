## 1. Bake the hurricane cloud template

- [x] 1.1 Add `frontend/scripts/bake-hurricane-cloud.mjs` mirroring `bake-cloud-noise.mjs` (deterministic integer hash, no `Math.random`, periodic in the angle axis, writes next to the GL renderer). Emit a polar RGBA8 `.bin` indexed by `(angle θ, normalized radius r)`.
- [x] 1.2 Encode the channels: **R** = log-spiral band density + a bright eyewall ring near `r ≈ r_eye`, zero inside the eye (`r < r_eye`) and faded to zero at `r → 1`, with a small periodic worley jitter; **G** = height multiplier (tall at the eyewall, tapering outward); B = eye mask (0 in the eye → 1 outside); A reserved.
- [x] 1.3 Run `node scripts/bake-hurricane-cloud.mjs`, eyeball the output size (~256 KB target), and commit `hurricane-cloud.bin`.

## 2. Extend the GPU cloud renderer (`globe/clouds-gl/index.ts`)

- [x] 2.1 Load `hurricane-cloud.bin` in `loadNoise()` and upload it as a `sampler2D` (`WRAP_S = REPEAT`, `WRAP_T = CLAMP_TO_EDGE`, `LINEAR`); bind it to a new texture unit and add its uniform.
- [x] 2.2 Add per-storm uniforms — `uStormCount`, `uStormPos[]` (world vec3), `uStormRadius[]`, `uStormDensity[]`, `uStormSpin[]`, `uStormPhaseBase[]` — with a `MAX_STORMS` cap (≈8); register their locations.
- [x] 2.3 Add a `setStorms(storms)` method (parallel to `setField`) that maps a storm list to world-space centers (lon/lat → unit vec3) and category-scaled radius/density/spin, packs up to `MAX_STORMS`, and drops (with a `console.warn`) any beyond the cap.
- [x] 2.4 In the fragment shader add `stormCoverage(vec3 dir)`: for each storm, early-out when `dot(dir, c) < cos(ρ_max)`; else compute `ρ = acos(dot(dir, c))`, `r = ρ / ρ_max`, bearing `θ = atan2(dot(dir,e), dot(dir,n))` in the tangent frame at `c`, apply `θ' = spin·(θ + phase)`, sample the template at `(θ'/2π, r)`, scale by density, and accumulate.
- [x] 2.5 Fold `stormCoverage(dir)` into `coverage()` (add to the field term, then `clamp(…,0,1)`) and route its G-channel height multiplier into the shell's `heightProfile` so the eyewall stands taller; verify the eye stays a clean hole through `sampleDensity`'s noise multiply.
- [x] 2.6 Drive the storm phase from the existing time/animate uniforms in `render()` (phase advances only when `animate`), so band rotation freezes under `reduceMotion`.

## 3. Wire storms into the shell (`globe/Globe.tsx`)

- [x] 3.1 Each frame, before `cloudGL.render(...)`, call `cloudGL.setStorms(...)` with the same list the 2D block builds today (live `storms.current` mapped by category/hemisphere, else curated `STORMS`).
- [x] 3.2 Extend the `cloudKey` render-cache signature with a storm summary (positions + categories + motion bucket) so the shell re-raymarches on storm move/phase change and reuses the cached bitmap otherwise.
- [x] 3.3 Gate the existing 2D line-spiral storm block to draw **only** when the GPU cloud path is not active (`!useGpu` / `CLOUD_MODE === 'off'` / context lost); keep the dashed forecast **track** and numeric labels drawn in both paths, above the cloud.
- [x] 3.4 Confirm the right-panel active-storms list and its live/decorative fallback are untouched.

## 4. Docs & verification

- [x] 4.1 Note in `views/Methodology.tsx` that storms render as baked volumetric hurricane clouds on the GPU shell.
- [x] 4.2 Verify GPU path: shader compiles+links at mount (no `[clouds-gl]` warnings) and `hurricane-cloud.bin` uploads; a synchronous GPU readback against the real baked asset confirms clear eye (R=0, eye-mask=0), dense eyewall (250/255), full-density spiral bands (254/255), and hemisphere chirality flip (spin ±1 differs). Category scaling and sun-lit/limb/occlusion are inherited unchanged from the shipped shell fed via `coverage()`. (Full composited screenshot not capturable: the automation tab is backgrounded so the app's rAF render loop is paused.)
- [x] 4.3 `reduceMotion` freeze confirmed by code path — `uStormOmega = animate ? STORM_OMEGA : 0` and the render key uses `tBucket = 0` when not animating, so the shell holds static; typecheck + build pass.
- [x] 4.4 Fallback paths confirmed in code — the 2D line spiral draws only when `!useGpuClouds`; the curated `STORMS` set feeds `stormList` (rendered as hurricane clouds) when no live storms; the canvas-2D / sprite field fallbacks remain guarded by `fld`.
- [x] 4.5 Ran `openspec validate baked-hurricane-clouds --strict` (valid) and the frontend `tsc -b` + `vite build` (clean; hurricane-cloud.bin bundled, JS gzip 132.82 kB).
