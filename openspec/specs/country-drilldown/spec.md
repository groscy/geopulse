# country-drilldown Specification

## Purpose
TBD - created by archiving change m2-drilldown-incidents. Update Purpose after archive.
## Requirements
### Requirement: Composite state banner
When a country is selected, the right panel SHALL show a drill-down header with the country flag, name, region subline, and a composite state banner tinted by state, labeled with the state name and the driving source·age (e.g. "GDELT · 3 min").

#### Scenario: Select shows banner
- **WHEN** a country is selected on the globe or from the feed
- **THEN** the panel switches from the incident feed to that country's drill-down with the tinted composite banner

### Requirement: Domain chips
The drill-down SHALL show three domain chips — Economy, Markets, Relations — each a small card with a state dot and state name colored by that domain's state.

#### Scenario: Domain states shown
- **WHEN** Japan is selected with Markets degraded and Economy/Relations operational
- **THEN** the Markets chip renders amber and the others green

### Requirement: Key-metric rows with sparklines
The drill-down SHALL show six key-metric rows — main equity index, 10Y bond yield, FX vs USD, inflation (CPI), GDP growth, debt/GDP — each with a label, source·age (mono), a small sparkline in the metric's state color, the current value and a delta (mono, state-colored), and a trailing state dot. Metrics without data SHALL render as stale, not as zero.

#### Scenario: Sparkline row
- **WHEN** the drill-down renders the equity-index row for a country with history
- **THEN** it shows a sparkline of recent values, the current value, and a state-colored delta

#### Scenario: Missing metric is stale
- **WHEN** a country has no data for a metric (e.g. Eritrea 10Y yield)
- **THEN** that row renders in the stale style with a source age, not a fabricated value

### Requirement: Top relations
The drill-down SHALL list the country's top bilateral relations by |tone|, each with the partner flag and name, a tone bar (hostile→tense→warm gradient) with a marker positioned by z ∈ [−2,2], and the z value in mono, tone-colored.

#### Scenario: Relations ranked by magnitude
- **WHEN** Japan is selected
- **THEN** its strongest-|tone| partners are listed with tone bars positioned by their z values

### Requirement: Active incidents in drill-down
The drill-down SHALL show the country's currently active incidents as compact cards (state dot + title + metric·since); clicking one opens the incident detail modal.

#### Scenario: Country incident opens modal
- **WHEN** a country with an active incident is selected and its incident card clicked
- **THEN** the incident detail modal opens for that incident

### Requirement: News domain in drill-down
When a country is selected, the drill-down SHALL show a News domain chip (state dot + state name colored by the `news` domain state) and its underlying metric rows — news tone, conflict intensity (Goldstein), and coverage volume — in the standard key-metric row style (label, source·age, sparkline, value, trailing state dot). The News chip SHALL be presented so it reads as informational and distinct from the composite-contributing domains (Economy/Markets/Relations), and metrics without data SHALL render as stale, not as fabricated zeros.

#### Scenario: News chip shown
- **WHEN** a country with a computed `news` domain is selected
- **THEN** the drill-down shows a News chip colored by the news state and its tone/Goldstein/volume rows with source·age and sparklines

#### Scenario: News stale rows
- **WHEN** a selected country has insufficient news baseline
- **THEN** the News chip and its rows render in the stale style, not as fabricated zeros

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

