## ADDED Requirements

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
