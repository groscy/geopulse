## MODIFIED Requirements

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
