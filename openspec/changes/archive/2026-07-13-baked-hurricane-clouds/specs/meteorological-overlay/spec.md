# meteorological-overlay Specification (delta)

## MODIFIED Requirements

### Requirement: Storm spirals
The overlay SHALL render each **live active tropical cyclone** sourced from `GET /api/storms` as a **baked volumetric hurricane cloud** on the GPU-raymarched atmospheric shell: a banded spiral (log-spiral rain bands) with a dense convective **eyewall** ring and a clear calm **eye**, built by injecting a **baked hurricane template** into the shell's cloud coverage so the existing baked worley-perlin noise carves it into a three-dimensional cloud and the existing sub-solar lighting lights it (a lit top and shadowed base). Each cyclone SHALL be drawn at the storm's real position, **sized and emphasized by its Saffir-Simpson category** (higher category → larger, denser system), with its spiral **chirality following the hemisphere** (cyclonic: counter-clockwise in the north, clockwise in the south), and SHALL remain occlusion-correct and stand **above the limb** like the rest of the shell. The cyclone SHALL preserve the existing paint order and independence: the temperature/precipitation/wind choropleth, the near-term forecast **track**, the numeric labels, and the right-panel active-storms list SHALL render unchanged, with the track and labels remaining legible above the cloud. Band **rotation SHALL respect `reduceMotion`** (frozen when set) and the render SHALL stay performance-bounded (bounded per-storm cost inside the already-bounded raymarch; re-render only on camera/time/storm change).

When no live storm data is available — the demo/fixtures path where the API base is unset, the feed is empty, or no cyclones are currently active — the overlay SHALL fall back to the **curated decorative storm set**, still rendered as baked hurricane clouds, so the layer still reads. When the GPU cloud path is unavailable (WebGL2 missing, the context is lost, or the cloud mode is off), the overlay SHALL fall back to the **retained 2D line-spiral** render, so the storm layer is never blank on capable data.

#### Scenario: Hurricanes render as volumetric cloud
- **WHEN** the overlay is on, `/api/storms` returns active cyclones, and WebGL2 (the GPU cloud path) is available
- **THEN** each cyclone renders as a sun-lit volumetric hurricane cloud — spiral rain bands, a dense eyewall, and a clear eye — standing over the globe, denser and larger for higher Saffir-Simpson categories

#### Scenario: Chirality follows the hemisphere
- **WHEN** a rendered cyclone is in the northern hemisphere versus the southern hemisphere
- **THEN** its spiral bands wind counter-clockwise in the north and clockwise in the south

#### Scenario: Cyclone stands over the limb, occlusion preserved
- **WHEN** the globe is rotated so a cyclone reaches the horizon
- **THEN** its cloud renders standing above the limb (against space) and only on the near hemisphere, with the planet occluding cloud behind it — never clipped flat at the disc edge

#### Scenario: Band rotation respects reduce-motion
- **WHEN** the cyclone's bands animate (rotation) and `reduceMotion` is on
- **THEN** the bands hold static; and in all cases the render stays performance-bounded so globe drag/rotate remains smooth

#### Scenario: Track, labels, and panel unaffected
- **WHEN** cyclones are shown as volumetric hurricane clouds
- **THEN** the choropleth, the dashed forecast track, the numeric labels, and the right-panel active-storms list render unchanged, and the track and labels remain legible above the cloud

#### Scenario: Fallback to decorative storms
- **WHEN** the overlay is on but no live storm data is available (fixtures/demo, empty feed, or no active cyclones)
- **THEN** the curated decorative storms render as baked hurricane clouds, so the layer is never blank

#### Scenario: Fallback to 2D spiral without the GPU path
- **WHEN** the overlay is on with storm data but WebGL2 is unavailable, its context is lost, or the cloud mode is off
- **THEN** the retained 2D line-spiral render draws instead, at each storm's position, category-sized, hemisphere-chiral, with rotation respecting `reduceMotion`
