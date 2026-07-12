## ADDED Requirements

### Requirement: Weather facets in the drill-down
The country drill-down SHALL render a standalone **Weather** section listing each of the country's scored weather facets as a state+value row (facet label, latest value with unit, committed state, and reading age), using the same row presentation as the other domain metrics. The section SHALL be labelled standalone — scored and incident-driving, but not part of the worst-of composite (the same framing as News). A facet in baseline warm-up SHALL render as `stale` / `—`, never a fabricated value.

#### Scenario: Weather section shown in the drill-down
- **WHEN** a country with scored weather facets is opened in the drill-down
- **THEN** a Weather section lists each facet with its latest value, unit, state, and age, styled like the other metric rows

#### Scenario: Standalone framing
- **WHEN** the Weather section is shown
- **THEN** it is marked as standalone (not feeding the composite), consistent with how weather is described elsewhere

#### Scenario: Warm-up facet renders stale
- **WHEN** a facet has insufficient history for the country
- **THEN** its row renders as stale / `—`, not a fabricated value
