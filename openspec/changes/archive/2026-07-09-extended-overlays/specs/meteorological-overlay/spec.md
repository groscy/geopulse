## ADDED Requirements

### Requirement: Temperature choropleth
The Meteorological overlay SHALL fill land by surface temperature (derived from latitude + seed) using the six-stop temperature scale (`−10 #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`) at ~0.58 alpha, and SHALL show the temperature-scale legend.

#### Scenario: Land colored by temperature
- **WHEN** the Meteorological overlay is on
- **THEN** land renders along the temperature scale and the legend shows the temperature stops

### Requirement: Storm spirals
The overlay SHALL render five rotating storm spirals at curated locations: Hurricane · Caribbean (Cat 3), Typhoon · W Pacific (Cat 4), N-Atlantic low (968 hPa), Bay of Bengal (Cat 1), Coral Sea (Cat 2). Spiral rotation SHALL respect `reduceMotion`.

#### Scenario: Storms render and spin
- **WHEN** the overlay is on and `reduceMotion` is off
- **THEN** the five storm spirals render at their locations and rotate slowly; when `reduceMotion` is on, they hold static

### Requirement: Active storms panel
The right panel SHALL list the active storm systems with name and category.

#### Scenario: Storms listed
- **WHEN** the Meteorological overlay panel shows
- **THEN** it lists the five storms with their category labels
