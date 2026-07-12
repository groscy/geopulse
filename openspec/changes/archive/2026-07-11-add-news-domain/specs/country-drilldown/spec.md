## ADDED Requirements

### Requirement: News domain in drill-down
When a country is selected, the drill-down SHALL show a News domain chip (state dot + state name colored by the `news` domain state) and its underlying metric rows — news tone, conflict intensity (Goldstein), and coverage volume — in the standard key-metric row style (label, source·age, sparkline, value, trailing state dot). The News chip SHALL be presented so it reads as informational and distinct from the composite-contributing domains (Economy/Markets/Relations), and metrics without data SHALL render as stale, not as fabricated zeros.

#### Scenario: News chip shown
- **WHEN** a country with a computed `news` domain is selected
- **THEN** the drill-down shows a News chip colored by the news state and its tone/Goldstein/volume rows with source·age and sparklines

#### Scenario: News stale rows
- **WHEN** a selected country has insufficient news baseline
- **THEN** the News chip and its rows render in the stale style, not as fabricated zeros
