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
The overlay SHALL render rotating storm spirals for **live active tropical cyclones** sourced from `GET /api/storms`, each drawn at the storm's real position and sized/emphasized by its Saffir-Simpson category, optionally with its forecast track. Spiral rotation SHALL respect `reduceMotion`. When no live storm data is available — the demo/fixtures path where the API base is unset, the feed is empty, or no cyclones are currently active — the overlay SHALL fall back to the curated decorative storm set so the layer still reads.

#### Scenario: Storms render and spin
- **WHEN** the overlay is on and `/api/storms` returns active cyclones
- **THEN** storm spirals render at each cyclone's real position, sized by category, and rotate (holding static when `reduceMotion` is on)

#### Scenario: Fallback to decorative storms
- **WHEN** the overlay is on but no live storm data is available (fixtures/demo, empty feed, or no active cyclones)
- **THEN** the curated decorative storm spirals render, so the layer is never blank

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
The Meteorological overlay's atmospheric field shell SHALL render cloud as a **continuous** layer that **supersedes** the discrete per-node sprite render: cloud density SHALL be **interpolated** between the field's grid nodes and modulated by multi-octave noise into soft cloud masses, composited above the globe surface with opacity following the interpolated cloud cover %. The render SHALL remain occlusion-correct — only the near, visible hemisphere is drawn, faded at the limb, nothing behind the globe — and SHALL draw **above** and independently of the temperature/precipitation/wind choropleth, the storm spirals, and the numeric labels, none of which change. Where interpolated precipitation is high, the render MAY add a subtle precipitation emphasis. When no field data is available (worker warm-up or empty feed), it SHALL render nothing (empty state), never fabricated cloud. Any motion (noise advection along the interpolated wind `u`/`v`) SHALL respect `reduceMotion`. The render SHALL be performance-bounded (e.g. a throttled, cached offscreen cloud texture) so globe drag/rotate stays smooth.

#### Scenario: Continuous cloud masses render above the globe
- **WHEN** the Meteorological overlay is on and `/api/weather-field` returns a grid
- **THEN** clouds render as continuous, interpolated, noise-textured masses (not discrete puffs), denser where cloud cover is higher, over the existing choropleth

#### Scenario: Occlusion and limb fade preserved
- **WHEN** the globe is rotated
- **THEN** cloud is drawn only on the near hemisphere, faded toward the limb, with nothing behind the globe

#### Scenario: Choropleth, storms, and labels unaffected
- **WHEN** the continuous cloud layer is shown
- **THEN** the temperature/precipitation/wind choropleth, mode selector, storm spirals, and numeric labels render unchanged beneath it

#### Scenario: Empty state without field data
- **WHEN** the overlay is on but no field data is available
- **THEN** the cloud layer renders nothing, without fabricating cloud

#### Scenario: Motion respects reduce-motion and stays interactive
- **WHEN** the cloud layer animates (noise advection along wind) and `reduceMotion` is on
- **THEN** it holds static; and in all cases the render stays performance-bounded so globe drag/rotate remains smooth

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

