## MODIFIED Requirements

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
