# incident-detection Specification

## Purpose
TBD - created by archiving change m2-drilldown-incidents. Update Purpose after archive.
## Requirements
### Requirement: State-transition hysteresis
The scoring engine SHALL require a state to hold for N consecutive evaluations (default N=3, configurable) before a country's persisted state changes, and SHALL use asymmetric thresholds — enter a worse state at |z|=1.0, recover to a better state only below |z|=0.7 — to prevent flapping around a boundary.

#### Scenario: Transient spike ignored
- **WHEN** a country's z crosses into degraded for a single evaluation and then returns
- **THEN** its persisted state does not change, because the new state did not hold for N evaluations

#### Scenario: Sustained change commits
- **WHEN** a country's z stays in degraded for N consecutive evaluations
- **THEN** its persisted state transitions to degraded

#### Scenario: Recovery band
- **WHEN** a degraded country's |z| falls between 0.7 and 1.0
- **THEN** it does NOT yet recover to operational; it recovers only once |z| drops below 0.7 for N evaluations

### Requirement: Threshold detection opens incidents
When a monitored metric or domain crosses a configured threshold, the engine SHALL open an `incident` row capturing severity, affected country codes, the triggering metric, the threshold, a human-readable title, a `started_at`, and a `detail jsonb` with the decomposition. Duplicate open incidents for the same (country, metric, threshold) SHALL NOT be created while one is active.

#### Scenario: Breach opens an incident
- **WHEN** JPY realized volatility crosses its degraded threshold (z +2.1)
- **THEN** one incident is opened with severity=degraded, countries=[JPN], the triggering metric, and `started_at` set

#### Scenario: No duplicate while active
- **WHEN** the same metric remains in breach across evaluations
- **THEN** the existing open incident is kept, not duplicated

### Requirement: Incident resolution
The engine SHALL resolve an open incident (set `resolved_at`) once its triggering condition recovers under the hysteresis recovery rule, so the feed can distinguish ongoing from resolved incidents.

#### Scenario: Recovery closes an incident
- **WHEN** a breached metric recovers below its recovery threshold for N evaluations
- **THEN** the corresponding incident's `resolved_at` is set and it is marked resolved

### Requirement: Incident schema
Incidents SHALL be stored in `incident(id uuid, severity text, countries char(3)[], metric text, threshold text, started_at timestamptz, resolved_at timestamptz, title text, detail jsonb)`.

#### Scenario: Multi-country incident
- **WHEN** a bilateral relation (e.g. US↔CN tone) breaches
- **THEN** the incident's `countries` array contains both affected codes

