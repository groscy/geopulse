## ADDED Requirements

### Requirement: Numeric temperature labels with level-of-detail
When the Meteorological overlay is on, the globe SHALL render each tracked country's temperature as a numeric label (rounded °C) centered on the country. Labels SHALL be drawn only for countries that have live weather data (never for the synthetic latitude fallback) and only for countries on the near, visible hemisphere. Labels SHALL apply a level-of-detail rule keyed to each country's on-screen size, so a label appears only once the country is large enough on screen to host the text — larger countries are therefore labeled at the default zoom and smaller countries reveal their temperature progressively as the globe is zoomed in. Labels SHALL be legible over the temperature choropleth (light text with a dark halo).

#### Scenario: Large countries labeled at default zoom
- **WHEN** the Meteorological overlay is on at the default zoom
- **THEN** countries large enough on screen display their temperature number, while countries too small on screen display none

#### Scenario: Smaller countries revealed on zoom-in
- **WHEN** the user zooms the globe in
- **THEN** smaller countries whose on-screen size crosses the level-of-detail threshold begin displaying their temperature number

#### Scenario: No label without live data
- **WHEN** a country has no live weather reading and renders via the latitude fallback tint
- **THEN** no numeric temperature label is shown for that country

#### Scenario: Far-hemisphere countries unlabeled
- **WHEN** a country is on the far side of the globe
- **THEN** its temperature label is not drawn
