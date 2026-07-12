## ADDED Requirements

### Requirement: Atmospheric field shell
The Meteorological overlay SHALL render an **atmospheric field shell** sourced from `GET /api/weather-field`: cloud cover drawn as translucent shells/particles **lifted above** the globe surface at the field's grid nodes, with opacity scaled by each node's cloud cover %. The shell SHALL be occlusion-correct — nodes on the far hemisphere or hidden behind the globe SHALL NOT be drawn — reusing the globe's existing lift/occlusion behavior. The shell SHALL render **above** and independently of the temperature/precipitation/wind choropleth, the storm spirals, and the numeric labels, none of which change. This is where **cloud cover** is surfaced (deferred from the point-hazard facets). When no field data is available (worker warm-up or the feed is empty), the shell SHALL render nothing (an empty state) rather than fabricating cloud. Any motion of the shell (e.g. wind-driven drift along the node `u`/`v` vectors) SHALL respect `reduceMotion`.

#### Scenario: Cloud shell renders above the globe
- **WHEN** the Meteorological overlay is on and `/api/weather-field` returns a grid
- **THEN** translucent cloud shells/particles render lifted above the surface, denser where cloud cover is higher, over the existing choropleth

#### Scenario: Occlusion correctness
- **WHEN** the globe is rotated
- **THEN** cloud shell nodes on the far side or hidden behind the globe are not drawn, and near-hemisphere nodes are

#### Scenario: Choropleth and facets unaffected
- **WHEN** the atmospheric shell is shown
- **THEN** the temperature/precipitation/wind choropleth, its mode selector, the storm spirals, and the numeric labels render unchanged beneath it

#### Scenario: Empty state without field data
- **WHEN** the overlay is on but no field data is available (worker warm-up or empty feed)
- **THEN** the shell renders nothing, without fabricating cloud cover

#### Scenario: Motion respects reduce-motion
- **WHEN** the shell animates (wind-driven drift) and `reduceMotion` is on
- **THEN** the shell holds static
