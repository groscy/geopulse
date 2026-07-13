## Why

Live cyclones currently render as an abstract **2-arm line spiral** drawn on the 2D canvas — a schematic glyph that reads as "a storm marker", not as a storm. Meanwhile the atmospheric field already renders as a **GPU-raymarched, sun-lit volumetric cloud shell** (`add-raymarched-clouds`). The visual gap is jarring: continuous weather is volumetric cloud, but the most dramatic weather — a hurricane — is a thin vector doodle sitting on top of it. This change closes that gap by rendering each cyclone as an actual **baked hurricane cloud**: a banded, eyewalled, sun-lit volumetric spiral standing over the globe, riding the same raymarch shell the field already uses.

## What Changes

- **Baked hurricane cloud template (new committed asset).** A small deterministic offline bake script (mirroring `bake-cloud-noise.mjs`) emits a **polar hurricane structure** — log-spiral rain bands, a dense convective eyewall ring, a clear calm eye, and a per-radius height profile (tall eyewall, lower outer bands) — as a channel-packed `.bin`, run once and committed. Blender is not used (periodicity + the analytic spiral are cleaner in a purpose-built bake, consistent with the existing noise bake).
- **Storms injected into the existing volumetric cloud shell.** The GPU raymarcher gains a small set of **per-storm uniforms** (center lon/lat, category-scaled radius, spin sign, rotation phase). For each marched sample the shader converts world lon/lat into storm-local polar coordinates (great-circle distance + bearing), samples the baked hurricane template, and **adds it into cloud coverage** — so the existing base/detail worley-perlin noise carves it into billowy cloud and the existing sun-lighting (Beer-Powder + Henyey-Greenstein) lights it. Coverage from a baked hurricane stamp, volume from the existing baked noise — exactly parallel to "coverage from the field, volume from baked noise".
- **Category-scaled, hemisphere-chiral, sun-lit, over the limb.** Saffir-Simpson category scales the storm's radius and density; hemisphere sets spiral chirality (cyclonic: CCW north / CW south); the cyclone is sun-lit and stands above the limb like the rest of the shell. Rotation of the bands respects `reduceMotion` (frozen when set).
- **The 2D line spiral becomes the fallback.** The abstract canvas spiral is **retained** and drawn only when the GPU cloud path is unavailable (WebGL2 missing / context lost / cloud mode off), exactly as the canvas-2D cloud texture is retained as the raymarch fallback. The near-term forecast **track** (dashed line) and the right-panel active-storms list are **unchanged** and still drawn above the cloud.
- **No backend change.** Same `GET /api/storms` payload (position, category, track) and the same curated decorative fallback set; the storm data is re-purposed into raymarch uniforms client-side.

## Capabilities

### New Capabilities
<!-- none — this reuses the existing meteorological-overlay capability and its raymarch infrastructure -->

### Modified Capabilities
- `meteorological-overlay`: the **Storm spirals** requirement changes — live/decorative cyclones render as **baked volumetric hurricane clouds** on the GPU raymarched shell (banded, eyewalled, clear eye, sun-lit, standing over the limb), category-scaled and hemisphere-chiral, with band rotation respecting `reduceMotion`; the existing 2D line spiral is retained as the canvas-2D / no-WebGL2 fallback, and the forecast track, active-storms panel, choropleth, labels, and paint order are preserved.

## Impact

- **frontend**:
  - New offline bake script `frontend/scripts/bake-hurricane-cloud.mjs` + its committed baked asset in `frontend/src/globe/clouds-gl/`.
  - `globe/clouds-gl/index.ts`: load the hurricane template as a sampler, add per-storm uniforms + a `setStorms()` method, and a `stormCoverage()` contribution in the fragment shader folded into `coverage()`.
  - `globe/Globe.tsx`: feed the live (or curated) storm list into `cloudGL` each frame; keep the 2D-spiral render behind the fallback branch (drawn only when the GPU cloud path is off/unavailable); keep the forecast track and panel.
  - `views/Methodology.tsx`: note that storms render as baked volumetric hurricane clouds.
- **backend**: none — same `/api/storms`, same field payload, no worker/endpoint/db change.
- **assets**: one baked hurricane template (small; a compact polar RGBA `.bin`), loaded once at GL init alongside the cloud noise volumes.
- **External APIs**: none.
- **Milestone / NFR**: frontend polish on the M-series meteorological overlay; honors the existing NFRs — 60 fps globe budget (bounded per-storm cost inside the already-bounded raymarch, re-render only on camera/time/storm change), `reduceMotion`, and graceful WebGL2 fallback.

## Out of scope

- Per-storm bespoke art-directed cloud *shapes* (all cyclones share the one baked template, scaled by category) — a possible follow-up.
- Coupling the cyclone cloud to precip/wind field channels, storm-surge, or a volumetric forecast cone.
- Porting the forecast track or the active-storms panel to the GPU (they stay 2D/DOM).
- Animating intensity change over forecast time (playback) — storms render at their current category only.
- Any change to storm data, the `/api/storms` contract, or the curated decorative fallback set.
