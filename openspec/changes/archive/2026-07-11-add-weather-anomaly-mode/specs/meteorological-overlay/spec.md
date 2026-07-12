## ADDED Requirements

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
