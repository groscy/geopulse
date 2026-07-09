## ADDED Requirements

### Requirement: Source and age on every value
Every displayed metric value SHALL be accompanied by its source and its age (time since the underlying observation's `ts`), rendered in IBM Plex Mono, so the user can always tell where a number came from and how fresh it is.

#### Scenario: Metric shows provenance
- **WHEN** a drill-down metric row renders
- **THEN** it shows the value alongside a "source · age" label (e.g. "GDELT · 3 min")

### Requirement: Stale values are visually flagged
Values computed from stale data SHALL be visually distinguished — grey diagonal hatch on the map and a clock/hatch treatment in panels and legends — and SHALL NEVER be rendered in a solid health color. Stale is a distinct state, not a shade of operational.

#### Scenario: Stale on the map
- **WHEN** a country's composite is stale (coverage < 50% or aged-out inputs)
- **THEN** it renders with the grey `repeating-linear-gradient(45deg,...)` hatch, distinct from healthy green

#### Scenario: Stale in the panel
- **WHEN** Eritrea's economy domain is stale with a 94-day-old GDP print
- **THEN** the domain chip and metric rows show the stale treatment and the age, not a healthy color

### Requirement: Age-driven staleness threshold
The staleness treatment SHALL be driven by per-metric age thresholds (τ / max-age from config) rather than a single global cutoff, consistent with the scoring engine's staleness discount, so slow-cadence metrics (macro) and fast ones (markets) are judged appropriately.

#### Scenario: Fast vs slow metric
- **WHEN** a daily macro metric is 1 day old and a 5-minute markets metric is 1 hour old
- **THEN** the markets metric flags stale while the macro metric does not, per their respective thresholds
