## Context

The globe is a single imperative **canvas-2D** surface (D3-geo orthographic, retina-scaled) with a strict paint order; there is no WebGL anywhere in the app. `add-volumetric-cloud-field` rendered clouds as a throttled offscreen density texture composited onto the sphere disc (`Globe.tsx`, the `CLOUD_VOLUMETRIC` block). That render is continuous but **flat** — no lighting, no cast shadow, no height, hard-clipped at the disc. This change offloads the cloud render to the **GPU** while reusing everything the field already provides: the coverage grid, the sub-solar sun vector, the occlusion/limb math, and the `reduceMotion` gate. It is a **render-substrate** change (canvas-2D → WebGL2 raymarch), not a data change — `/api/weather-field` and the field payload are untouched.

The decomposition the whole change rests on: **coverage (where + how much) stays in the 2D field; volume (how it looks) moves to the shader.** This is the standard real-time volumetric cloud recipe — a low-frequency 2D weather/coverage texture masks 3D noise that carves the form.

## Goals / Non-Goals

**Goals:**
- Clouds read as **volume**: lit top / shadowed base, self-shadowing, height, and — the payoff — standing up over the **limb** against space.
- Reuse the existing field as the **coverage mask** and the existing sun/occlusion/`reduceMotion` machinery; no backend change.
- Land the GL layer with the **smallest viable integration** (composite into the existing 2D canvas, preserve paint order) and a **proven fallback** (the retained canvas-2D render).
- Front-load the one make-or-break risk (camera match) so it is retired before any noise or lighting work.

**Non-Goals:**
- No port of the land/choropleth/arcs/labels to WebGL — clouds-only GL layer over the 2D globe.
- No 3-canvas compositing refactor in v1 (noted as a later option if the per-frame blit is too costly).
- No Blender-baked cloud *shapes* (possible follow-up); no forecast-time animation; no storm change.

## Decisions

### Substrate: raw WebGL2, no dependency, half-res offscreen
A fullscreen quad + one fragment shader is ~150 lines of hand-rolled WebGL2; the codebase is aggressively dependency-light. three.js (~600 kB) is absurd for this and even regl (~30 kB) is more than a single raymarch pass needs. **WebGL2** specifically buys true `TEXTURE_3D` (hardware trilinear + wrap), so the baked noise is a real `sampler3D` rather than a 2D flipbook-atlas hack. The cloud buffer renders at **½ resolution** (clouds are low-frequency; upscaling on composite is nearly free) as the primary perf knob, with a sample cap as the second. *Alternative rejected:* a WebGL library (needless weight); WebGL1 + atlas (loses `sampler3D`).

### Raymarch geometry: orthographic makes it cheap; the limb is the payoff
Orthographic projection means **all eye rays are parallel**, so the shell (`r ∈ [1.0, 1.05]`) has **analytic** entry/exit per pixel — no root-finding, just ray-sphere against two radii.

```
   cross-section, camera looking down ──▶ -z, all rays parallel

        space          r=1.05 (shell top)
         │            ╱───────────────╲
         │  ①────────●   near clouds   ●        ① disc rays (r_screen<1):
         │           │ ░░░▒▒▓▓ volume  │            march 1.05 → planet cap;
         │  ②────────┼───●─────────────┼──────       far hemisphere hidden
         │           │  ╱  PLANET r=1  ╲│         ② limb annulus (1<r_screen<1.05):
         │  ③────────┼─┼────────────────┼┼───        ray grazes PAST the planet →
                     ╲─┼────────────────┼╱            clouds over the horizon,
                       ╲────────────────╱             against space  ← money shot
```

The disc rays march from the shell top down to the planet front-cap (`z_planet = √(1 − r_screen²)`), so the opaque planet occludes back-hemisphere clouds for free. The limb annulus (`1 ≤ r_screen ≤ 1.05`) grazes past the planet and renders the clouds curving over the edge — the single thing the flat texture structurally cannot do. ~24–32 primary steps, a few secondary taps toward the sun; the marched segment is short and bounded.

### Coverage from the field (`sampler2D`), volume from baked noise (`sampler3D`)
The weather field is an equirectangular lon/lat grid — a natural coverage texture. Upload it as a `sampler2D` (re-uploaded on the 5-min refetch; tiny). Baked worley-perlin noise supplies the form:

```
  BASE SHAPE  64³ RGBA8 (~1 MB)            DETAIL  32³ RGB(A)8 (~130 KB)
  R = perlin-worley (billowy)              RGB = worley @ 3 rising freqs
  G/B/A = worley @ rising freqs            → erodes base edges into wisps

  density at march sample p on the shell:
    base   = combine(R, G/B/A)                    low-freq billows
    masked = base × coverage(lon,lat)             ← the field = the mask
    eroded = masked − detail(p)·edgeAmt           wispy edges
    shaped = eroded × heightProfile(r∈[1,1.05])   round base, wispy top
```

The `heightProfile` gives the shell real vertical structure (dense middle, rounded base, frayed top) rather than a uniform slab — cheap, and it matters for reading as volume. The field's coarseness is broken up by the detail noise, so the grid won't read as blocky. *Alternative rejected:* analytic in-shader fbm — ships without an asset but reads as procedural fog, not fluffy cloud (this change explicitly chose baked worley-perlin).

### Bake the noise with a committed script, not Blender
The volume must be **periodic** (seamless 3D tiling) and **channel-packed** (independent worley/perlin per RGBA channel). A purpose-built bake script controls both exactly; Blender's Voronoi/Noise nodes can generate the primitives but seamless tiling + 4-channel packing fight its bake model. So: a small deterministic **Node/JS bake script**, committed, run once, emitting a raw RGBA `.bin` (loaded via `fetch` → `gl.texImage3D` at init). Blender's real strength — baking *lit shapes* / impostors — is reserved for a possible later "art-directed cloud shapes" change. *Alternative rejected:* Blender-baked noise (periodicity/packing friction); runtime worley generation (too slow at init).

### Lighting: reuse the sub-solar sun; Beer-Powder + Henyey-Greenstein
The day/night overlay already computes the sub-solar point (`Globe.tsx`, inside `if (ov.sun)`). Lift that calc out so clouds are sun-lit even when the terminator overlay is off. In the march: Beer-Powder extinction for the dark base and lit top, a short secondary march (a few taps) toward the sun for self-shadow, and a Henyey-Greenstein forward-scatter term for the silver lining when looking toward the sun. Ambient sky term (bluish) fills the shadowed side. *Alternative rejected:* flat white (the current flatness); full multiple-scattering (overkill for an ambient decoration).

### Compositing: into the existing 2D canvas (spike), order preserved
The GL cloud buffer is composited into the existing 2D canvas **at the current cloud-draw point** via `OffscreenCanvas.transferToImageBitmap()` → `ctx.drawImage(bitmap, …)`. This preserves the exact paint order — clouds over choropleth/borders, labels/storms/arcs/selected-outline still drawn on top afterward — with a single localized edit and one visible canvas. `transferToImageBitmap` keeps the handoff GPU-side (no `preserveDrawingBuffer`, no CPU readback).

```
 (a) SPIKE — offscreen GL → composite in      (b) LATER — three stacked canvases
     one visible canvas, order preserved          z0 2D base · z1 GL clouds · z2 2D overlay
     + smallest diff, one render loop             + no per-frame blit
     − a ½-res blit per frame (measure it)        − splits draw() across two 2D contexts
```

*Decision:* ship (a); treat (b) as the escape hatch **only if** the per-frame blit measures too costly. The GL raymarch must re-run each frame the **camera or noise-time changes** (a cached buffer would misalign with the land under rotation); when idle and `reduceMotion` (or noise frozen), reuse the last frame.

### Fallback: retain the canvas-2D render, feature-detected
`CLOUD_VOLUMETRIC` becomes `gpu | canvas | off`. On no WebGL2 / context-loss / a weak-GPU opt-out, the existing continuous canvas-2D render draws instead. The GPU path is therefore **purely additive** over a proven render — no regression risk to the globe.

## Risks / Trade-offs

- **Camera match is the #1 risk.** The shader's screen→sphere→lon/lat un-rotation must reproduce `d3.geoRotation([λ, φ])` exactly, or clouds slide off the coastlines. → Retire it first: raymarch a **solid** shell and confirm it hugs the land under drag + zoom, before any noise/lighting confounds.
- **Composite alpha / fringing.** The GL buffer must be transparent where there is no cloud (land shows through) with no premultiplied-alpha dark halos. → `transferToImageBitmap`, correct premult handling; verify against ocean and bright land.
- **Per-frame cost on retina.** raymarch × secondary taps × DPR pixels, plus the blit. → ½-res buffer + sample cap; re-raymarch only on camera/time change; measure the blit and fall back to stacked canvases (b) if needed.
- **Weak / mobile GPUs, context loss.** → feature-detect WebGL2, cap resolution/samples, and degrade to the retained canvas-2D path; handle `webglcontextlost`.
- **Baked noise looks artificial if overdone.** → density is gated by the *real* coverage field; noise only carves within it; keep erosion/amplitude subtle and tunable.

## Migration Plan

Additive, reversible, and gated behind feature-detection. (1) Add the bake script + commit the baked volume. (2) Stand up the WebGL2 layer and prove the camera on a solid shell. (3) Layer in coverage → noise → lighting. (4) Wire the fallback selector and composite at the cloud-draw point. (5) Methodology note. **Rollback:** set `CLOUD_VOLUMETRIC = 'canvas'` (or remove the GL init) — the retained canvas-2D render takes over unchanged; nothing downstream of the field is touched.

## Open Questions (resolved with v1 defaults)

- **Compositing target?** → Composite into the existing 2D canvas (spike, approach *a*); 3-canvas stack only if the blit is too costly.
- **Noise: analytic or baked?** → **Baked worley-perlin** `sampler3D` (base 64³ + detail 32³), script-baked.
- **Bake with Blender?** → **No** — a committed bake script (periodicity + channel packing); Blender reserved for a later cloud-*shape* change.
- **Buffer resolution?** → **½ res**, upscaled on composite; sample-capped; tune against perf.
- **Animate?** → Wind-advected noise; frozen under `reduceMotion` and when idle.
