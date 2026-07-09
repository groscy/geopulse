# globe-visualization Specification

## Purpose
TBD - created by archiving change m1-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Canvas orthographic globe
The frontend SHALL render an interactive 3D globe on an HTML `<canvas>` using a D3-geo orthographic projection with country polygons from world-atlas `countries-110m` topojson. The canvas SHALL be retina-scaled by `devicePixelRatio` and the projection sized to the stage (`scale ≈ min(w,h) × 0.42`).

#### Scenario: Globe renders
- **WHEN** the app loads and tiles are fetched
- **THEN** a spherical globe with country borders draws on the canvas, filling the globe stage

### Requirement: Composite choropleth
Countries SHALL be colored by composite state using the canonical state palette — operational `#3f9d6b`, degraded `#d3a03f`, disrupted `#cc5b52` — and stale countries SHALL be rendered with the grey diagonal-hatch pattern, never a solid health color. Countries with no tile default to neutral land `#1c242e`.

#### Scenario: State colors applied
- **WHEN** tiles report `JPN: degraded`, `ARG: disrupted`, `CHE: operational`, `ERI: stale`
- **THEN** each country renders in its state color, and Eritrea shows the hatch pattern distinct from healthy green

### Requirement: Core globe interactions
The globe SHALL support drag-to-rotate, zoom, a hover tooltip showing the country name and composite state, and click-to-select that recenters the globe on the clicked country's centroid. Clicking the ocean deselects. Idle auto-rotation SHALL run when nothing is selected (respecting a `reduceMotion` flag).

#### Scenario: Hover tooltip
- **WHEN** the pointer hovers a country
- **THEN** a tooltip shows that country's name and composite state

#### Scenario: Click recenters
- **WHEN** a country is clicked
- **THEN** the globe animates to center that country's centroid and marks it selected

#### Scenario: Reduce motion
- **WHEN** `reduceMotion` is enabled
- **THEN** idle auto-rotation is disabled

### Requirement: Top-bar summary counts
The top bar SHALL show global summary counts derived from the tiles — number of countries operational / degraded / disrupted / stale — each as a colored dot plus a monospaced number, using IBM Plex Mono for numerals.

#### Scenario: Counts reflect tiles
- **WHEN** tiles are loaded
- **THEN** the top bar counts sum to the number of scored countries and update when tiles refresh

