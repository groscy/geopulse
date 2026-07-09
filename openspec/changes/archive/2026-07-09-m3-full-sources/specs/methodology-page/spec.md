## ADDED Requirements

### Requirement: Methodology page exists and is reachable
The app SHALL provide a methodology page, opened from the left-rail book icon, that replaces the body region (top bar retained) as a scrollable max-width reading column with a back button to the dashboard. It SHALL be a launch blocker per R-3 — the product SHALL NOT present composite scores as authoritative without it.

#### Scenario: Open methodology
- **WHEN** the user clicks the methodology (book) icon in the rail
- **THEN** the methodology page opens as a scrollable document with a back-to-dashboard control

### Requirement: Scoring disclosure
The methodology page SHALL disclose the full scoring approach: per-country self-relative z-scores against the 90-day baseline, the weighted staleness-discounted domain rollups, the worst-of composite rule, and the source cadences and weights.

#### Scenario: Z-score bands explained
- **WHEN** the user reads the z-score section
- **THEN** it shows the number-line diagram with Operational |z|<1 (green), Degraded 1≤|z|<2 (amber), Disrupted |z|≥2 (red), symmetric, with a sample marker

#### Scenario: Worst-of composite explained
- **WHEN** the user reads the composite section
- **THEN** it shows worked examples (e.g. Japan→Degraded, Argentina→Disrupted) marking the worst domain

### Requirement: Hysteresis and staleness disclosure
The methodology page SHALL explain hysteresis (enter at |z|=1.0, recover below |z|=0.7, N-evaluation hold) and SHALL explain that staleness is a distinct state, with a grey-hatch example and an aged-data case.

#### Scenario: Staleness is a state
- **WHEN** the user reads the staleness section
- **THEN** it shows a grey-hatch example and an aged-data case (e.g. Eritrea, 94-day-old print) and states that stale is never shown as healthy
