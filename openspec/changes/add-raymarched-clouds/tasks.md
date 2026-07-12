## 1. Baked noise volume (offline, independent — gates §3.3+)

- [x] 1.1 Write a committed deterministic **bake script** (Node/JS) that generates **periodic** worley-perlin noise and packs it channel-wise: base 64³ RGBA (R = perlin-worley, G/B/A = worley at rising frequencies) and detail 32³ RGB (worley at 3 rising frequencies). Emit raw RGBA `.bin` asset(s) (~1.1 MB total). — `frontend/scripts/bake-cloud-noise.mjs` → `frontend/src/globe/clouds-gl/cloud-noise-{base,detail}.bin` (1.13 MB total).
- [x] 1.2 Commit the baked asset(s) and a short note on re-running the bake; confirm the volume tiles seamlessly (no 3D seams when sampled with wrap). — verified: wrap-boundary Δ ≈ interior Δ on both volumes; re-run note in the script header.

## 2. WebGL2 layer + camera match (retire the #1 risk first)

- [x] 2.1 Stand up `globe/clouds-gl/`: a WebGL2 context on a ½-res `OffscreenCanvas`, a fullscreen-quad program, and uniform plumbing (rotation `[λ,φ]`, `R`, center, zoom, sun dir, `uTime`, shell radii). Feature-detect WebGL2. — `clouds-gl/index.ts`; `CloudGL.create()` returns null without WebGL2, verified `glReady`/`hasGL` true in-browser.
- [x] 2.2 **Camera match:** raymarch a **solid** (constant-density) shell and composite it into the 2D canvas at the current cloud-draw point via `transferToImageBitmap` → `drawImage`. Confirm the solid shell hugs the coastlines exactly under drag and zoom (reproduces `d3.geoRotation`), and that the limb annulus renders shell beyond the disc. No noise/lighting yet. — `uInvRot` mat3 built from d3's Euler convention (`Rz(-λ)·Ry(-φ)`), `uSolid` flag retained; verified clouds hug coastlines + 1204 limb-annulus cloud pixels beyond the disc.

## 3. Coverage + volume

- [x] 3.1 Upload the weather field as an equirectangular coverage `sampler2D` (re-upload on the 5-min refetch); mask the shell by interpolated coverage so cloud appears only where the field says, and the honest empty state renders nothing without field data. — `setField()` uploads the cloud channel as R8 with a field-key guard against re-upload; `uHasField=0` ⇒ coverage 0 ⇒ nothing renders.
- [x] 3.2 Upload the baked noise (`sampler3D`, base + detail); build the density function — `base × coverage`, edge-eroded by detail, shaped by a vertical **height profile** (rounded base, wispy top); confirm continuous volumetric masses (not blocky grid, not procedural fog). — `sampleDensity()` in the shader; verified as continuous billowy masses in-browser (screenshots).

## 4. Lighting + motion

- [x] 4.1 Lift the sub-solar sun calc out of the day/night block and light the march: Beer-Powder extinction (lit top / dark base), a short secondary march toward the sun for self-shadow, a Henyey-Greenstein forward-scatter (silver lining) term, and a bluish ambient fill. — `subSolarPoint()` extracted to module scope (shared with the terminator); shader does 4-tap sun march + Beer-Powder + HG; verified luminance spread p10 114 → p90 172 across cloud pixels.
- [x] 4.2 Advect the noise along the field's interpolated `u/v` when animating; freeze under `reduceMotion` and when idle. — `uWind` world drift scaled by `uTime`, zeroed when `animate` is false (`shouldAnimate` honors `reduceMotion`).

## 5. Fallback, perf, composite polish

- [x] 5.1 Make `CLOUD_VOLUMETRIC` a `gpu | canvas | off` selector: on no-WebGL2 / `webglcontextlost` / opt-out, draw the retained continuous canvas-2D render; handle context loss without breaking the globe. — `CLOUD_MODE` = `gpu|canvas|off`; `webglcontextlost` flips `lost` → caller degrades to canvas; `CloudGL.create()` wrapped in try/catch so GL setup can never abort the globe render.
- [x] 5.2 Performance-bound: re-raymarch only on camera or noise-time change (reuse the last frame when idle); confirm ½-res + sample cap holds drag/rotate smooth on retina; measure the per-frame blit and note the 3-canvas-stack escape hatch if it's too costly. — camera/time/field key gates re-render; cached bitmap redrawn on idle; ½-res buffer + STEPS=32/LIGHT_STEPS=4 caps; escape hatch noted in design.md.
- [x] 5.3 Composite correctness: transparent where no cloud (land/ocean show through), no premultiplied-alpha fringing; update the Methodology note to describe the GPU volumetric render. — `premultipliedAlpha:true` context + premultiplied shader output; verified choropleth shows through gaps with no fringe; Methodology §7 updated.

## 6. Verification

- [x] 6.1 Confirm clouds render as sun-lit volumetric masses with coverage from the field and form from the baked noise, stand over the limb, stay occlusion-correct, hold static under `reduceMotion`, keep drag/rotate smooth, and show the honest empty state without field data. — verified in-browser (live backend field): cloud pixels 0→14k, 1204 limb-annulus pixels beyond the disc, luminance spread 114→172; screenshots show billowy sun-lit banks.
- [x] 6.2 Confirm the choropleth, storm spirals, and numeric labels render unchanged and legible above the cloud, and that the canvas-2D fallback draws correctly when WebGL2 is forced off. No backend/endpoint change. — screenshots show choropleth through gaps + labels/storms above cloud; `CLOUD_MODE='canvas'` fallback rendered 113k cloud pixels; no `/api` change (field re-used client-side as coverage).
