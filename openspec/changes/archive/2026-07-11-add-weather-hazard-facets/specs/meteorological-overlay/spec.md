## MODIFIED Requirements

### Requirement: Temperature choropleth
The Meteorological overlay's **Temperature** mode SHALL fill land by each country's **7-day mean surface temperature**, sourced from live `weather_temp` observations via `GET /api/weather` rather than a synthetic latitude model, using the six-stop temperature scale (`−10 #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`) at ~0.58 alpha, and SHALL show the temperature-scale legend. Temperature mode SHALL be the default mode. When no live weather data is available for a country — including the demo/fixtures path where the API base is unset — the Temperature mode SHALL fall back to the existing latitude-derived tint so it still renders.

#### Scenario: Land colored by temperature
- **WHEN** the Meteorological overlay is on in Temperature mode and `/api/weather` returns per-country weekly-mean temperatures
- **THEN** land renders along the temperature scale from the real weekly means, and the legend shows the temperature stops

#### Scenario: Fallback when data absent
- **WHEN** the overlay is on in Temperature mode but no live weather data is available (fixtures/demo, or the weather feed is empty)
- **THEN** land renders along the temperature scale using the latitude-derived fallback tint, so the overlay is never blank

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

## ADDED Requirements

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
