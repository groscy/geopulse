# meteorological-overlay Specification

## Purpose
TBD - created by archiving change extended-overlays. Update Purpose after archive.
## Requirements
### Requirement: Temperature choropleth
The Meteorological overlay's **Temperature** mode SHALL fill land by each country's **7-day mean surface temperature**, sourced from live `weather_temp` observations via `GET /api/weather` rather than a synthetic latitude model, using the six-stop temperature scale (`−10 #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`) at ~0.58 alpha, and SHALL show the temperature-scale legend. Temperature mode SHALL be the default mode. When no live weather data is available for a country — including the demo/fixtures path where the API base is unset — the Temperature mode SHALL fall back to the existing latitude-derived tint so it still renders.

#### Scenario: Land colored by temperature
- **WHEN** the Meteorological overlay is on in Temperature mode and `/api/weather` returns per-country weekly-mean temperatures
- **THEN** land renders along the temperature scale from the real weekly means, and the legend shows the temperature stops

#### Scenario: Fallback when data absent
- **WHEN** the overlay is on in Temperature mode but no live weather data is available (fixtures/demo, or the weather feed is empty)
- **THEN** land renders along the temperature scale using the latitude-derived fallback tint, so the overlay is never blank

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

### Requirement: Active storms panel
The right panel SHALL list the **live active storm systems** from `GET /api/storms` with name and category, falling back to the curated set when no live data is available.

#### Scenario: Storms listed
- **WHEN** the Meteorological overlay panel shows and `/api/storms` returns active cyclones
- **THEN** it lists the real active systems with their category labels

#### Scenario: Panel fallback
- **WHEN** no live storm data is available
- **THEN** the panel lists the curated decorative storms

### Requirement: Numeric temperature labels with level-of-detail
When the Meteorological overlay is on, the globe SHALL render each tracked country's value **for the active mode** as a numeric label with the mode's unit (Temperature `23°`, Precipitation `48mm`, Wind `62 km/h`), centered on the country. Labels SHALL be drawn only for countries that have live weather data for the active mode (never for the synthetic latitude fallback, and never in Precipitation or Wind mode where no synthetic fallback exists) and only for countries on the near, visible hemisphere. Labels SHALL apply a level-of-detail rule keyed to each country's on-screen size, so a label appears only once the country is large enough on screen to host the text — larger countries are therefore labeled at the default zoom and smaller countries reveal their value progressively as the globe is zoomed in. Labels SHALL be legible over the choropleth (light text with a dark halo).

#### Scenario: Large countries labeled at default zoom
- **WHEN** the Meteorological overlay is on at the default zoom
- **THEN** countries large enough on screen display their active-mode value, while countries too small on screen display none

#### Scenario: Smaller countries revealed on zoom-in
- **WHEN** the user zooms the globe in
- **THEN** smaller countries whose on-screen size crosses the level-of-detail threshold begin displaying their active-mode value

#### Scenario: Label unit follows the active mode
- **WHEN** the user switches the overlay mode from Temperature to Precipitation or Wind
- **THEN** the numeric labels re-render with the new mode's value and unit (`mm` or `km/h`)

#### Scenario: No label without live data
- **WHEN** a country has no live weather reading for the active mode (including the Temperature latitude fallback, and all countries in Precipitation/Wind mode without live data)
- **THEN** no numeric label is shown for that country

#### Scenario: Far-hemisphere countries unlabeled
- **WHEN** a country is on the far side of the globe
- **THEN** its value label is not drawn

### Requirement: Meteorological choropleth mode selector
The Meteorological overlay SHALL provide a mode selector with three modes — **Temperature**, **Precipitation**, and **Wind** — defaulting to Temperature. Selecting a mode SHALL recolor the choropleth, swap the legend, and switch the numeric labels to that mode's value and unit, without adding or removing a left-rail overlay (the modes live inside the single Meteorological overlay) and without refetching (the payload carries all three facets).

#### Scenario: Switching modes recolors the globe
- **WHEN** the user selects Precipitation (or Wind) in the Meteorological overlay
- **THEN** the choropleth, legend, and labels update to that mode using data already fetched, and the left-rail overlay selection is unchanged

#### Scenario: Default mode
- **WHEN** the Meteorological overlay is first shown
- **THEN** it opens in Temperature mode

### Requirement: Precipitation and wind choropleth modes
The **Precipitation** mode SHALL fill land by each country's **7-day total precipitation** (mm) on a sequential scale with a millimetre legend, and the **Wind** mode SHALL fill land by each country's **7-day maximum wind speed** (km/h) on a sequential scale with a km/h legend, both sourced from live observations via `GET /api/weather`. Because precipitation and wind have no synthetic analog, in the demo/fixtures path or when the feed is empty these modes SHALL render no choropleth fill and no labels for countries lacking live data (an empty state), rather than fabricating a value.

#### Scenario: Land colored by precipitation
- **WHEN** the overlay is in Precipitation mode and `/api/weather` returns per-country 7-day precipitation totals
- **THEN** land renders along the sequential precipitation scale in millimetres, with the precipitation legend

#### Scenario: Land colored by wind
- **WHEN** the overlay is in Wind mode and `/api/weather` returns per-country 7-day maximum wind speeds
- **THEN** land renders along the sequential wind scale in km/h, with the wind legend

#### Scenario: No synthetic fallback for precip/wind
- **WHEN** the overlay is in Precipitation or Wind mode but no live weather data is available (fixtures/demo, or the feed is empty)
- **THEN** the choropleth shows no fill and no labels for those countries, without falling back to a fabricated value

### Requirement: Continuous cloud field render
The Meteorological overlay's atmospheric field shell SHALL render cloud as a **GPU-raymarched volumetric shell** that **supersedes** the flat canvas-2D cloud texture. A WebGL2 fragment shader SHALL raymarch a thin atmospheric shell above the globe surface over the near, visible hemisphere; the field's cloud cover SHALL supply the **coverage** (where cloud appears and how dense), sampled as an equirectangular texture and interpolated between grid nodes, and baked **worley-perlin 3D noise** SHALL supply the **volume** (the cloud form), so clouds read as lit, three-dimensional masses rather than a flat layer. The render SHALL be **sun-lit** from the sub-solar point (a lit top and a shadowed base), and SHALL remain **occlusion-correct** — only the near hemisphere is drawn and the planet occludes cloud behind it — while additionally rendering cloud that stands **above the limb** (over the horizon) where the shell projects beyond the globe's disc. It SHALL draw **above** and independently of the temperature/precipitation/wind choropleth, the storm spirals, and the numeric labels, none of which change, and SHALL preserve the existing paint order (labels and storms remain legible above the cloud). When no field data is available (worker warm-up or empty feed), it SHALL render nothing (empty state), never fabricated cloud. Any motion (noise advection along the interpolated wind `u`/`v`) SHALL respect `reduceMotion`. The render SHALL be performance-bounded (e.g. a reduced-resolution GPU buffer, bounded ray samples, and re-render only on camera or time change) so globe drag/rotate stays smooth. When WebGL2 is unavailable or its context is lost, the render SHALL fall back to the retained continuous canvas-2D cloud render, so the layer is never blank on capable data.

#### Scenario: Volumetric clouds render above the globe
- **WHEN** the Meteorological overlay is on, `/api/weather-field` returns a grid, and WebGL2 is available
- **THEN** clouds render as GPU-raymarched, sun-lit, three-dimensional masses — coverage from the field, form from the baked 3D noise — denser where cloud cover is higher, over the existing choropleth

#### Scenario: Clouds stand over the limb
- **WHEN** the globe is rotated so a cloudy region reaches the horizon
- **THEN** cloud renders standing above the limb (beyond the globe's disc, against space), not clipped flat at the edge

#### Scenario: Occlusion preserved
- **WHEN** the globe is rotated
- **THEN** cloud is drawn only on the near hemisphere with the planet occluding cloud behind it, and nothing from the far hemisphere shows through

#### Scenario: Choropleth, storms, and labels unaffected
- **WHEN** the volumetric cloud layer is shown
- **THEN** the temperature/precipitation/wind choropleth, mode selector, storm spirals, and numeric labels render unchanged, and labels and storms remain legible above the cloud

#### Scenario: Empty state without field data
- **WHEN** the overlay is on but no field data is available
- **THEN** the cloud layer renders nothing, without fabricating cloud

#### Scenario: Motion respects reduce-motion and stays interactive
- **WHEN** the cloud layer animates (noise advection along wind) and `reduceMotion` is on
- **THEN** it holds static; and in all cases the render stays performance-bounded so globe drag/rotate remains smooth

#### Scenario: Fallback without WebGL2
- **WHEN** the overlay is on with field data but WebGL2 is unavailable or its context is lost
- **THEN** the continuous canvas-2D cloud render draws instead, preserving occlusion, limb fade, the empty state, and `reduceMotion`

### Requirement: Value / Anomaly view toggle
The Meteorological overlay SHALL provide a **Value / Anomaly** view toggle, orthogonal to the Temperature/Precipitation/Wind mode selector and defaulting to **Value** (the existing absolute-aggregate choropleth). Selecting **Anomaly** SHALL recolor the active facet by its per-country signed anomaly z from `GET /api/weather`, swap the legend to the anomaly scale, and switch the numeric labels to the z (e.g. `+2.3σ`), all from data already fetched (no refetch). The absolute Value modes SHALL be unchanged.

#### Scenario: Switching to Anomaly recolors by z
- **WHEN** the user selects the Anomaly view for the active facet
- **THEN** land recolors by that facet's per-country anomaly z, the legend swaps to the anomaly scale, and the labels show z — using the already-fetched payload

#### Scenario: Value remains the default
- **WHEN** the Meteorological overlay is first shown
- **THEN** it opens in the Value view (absolute aggregates), unchanged from prior behavior

### Requirement: Directional anomaly scales
In the Anomaly view each facet SHALL use a scale that honors its directionality: **temperature** SHALL use a diverging scale centered on z = 0 (cool below baseline, warm above); **precipitation** and **wind** SHALL use a sequential scale from z = 0 up the positive (hazard) tail, rendering the non-hazard low tail (z ≤ 0) as neutral. Countries with no anomaly yet (stale facet / baseline warm-up) SHALL render as the stale hatch, never a fabricated zero.

#### Scenario: Temperature anomaly diverges
- **WHEN** the Anomaly view is active for temperature
- **THEN** unusually-cold countries render on the cool side and unusually-hot countries on the warm side of a zero-centered diverging scale

#### Scenario: One-sided facet paints only the hazard tail
- **WHEN** the Anomaly view is active for precipitation or wind
- **THEN** only the high (hazard) tail is colored; a below-baseline (calm/dry) country renders neutral

#### Scenario: No anomaly without a baseline
- **WHEN** a facet is stale for a country (baseline warm-up)
- **THEN** that country renders as the stale hatch in the Anomaly view, with no z label

