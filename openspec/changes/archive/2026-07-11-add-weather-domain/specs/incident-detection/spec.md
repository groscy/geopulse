## ADDED Requirements

### Requirement: Weather anomaly incidents
The engine SHALL open incidents for the standalone `weather` domain when a country's committed weather state reaches the configured weather incident floor (v1: `disrupted`, |z| ≥ 2), keyed `country:weather`, reusing the existing incident schema, dedup, and resolution lifecycle. Incident-eligibility SHALL be decoupled from worst-of-composite membership so that `weather` opens incidents while the `news` domain (also excluded from the composite) remains incident-free.

#### Scenario: Heat/cold anomaly opens an incident
- **WHEN** a country's committed `weather` state reaches the weather incident floor (disrupted)
- **THEN** exactly one `country:weather` incident is opened with severity, the triggering `weather_temp` decomposition in `detail`, and `started_at` set, without duplicating an already-open one

#### Scenario: Anomaly recovery resolves the incident
- **WHEN** the country's `weather` state recovers below the floor under the hysteresis recovery rule
- **THEN** the corresponding `country:weather` incident's `resolved_at` is set and it is marked resolved

#### Scenario: News remains incident-free
- **WHEN** a country's `news` domain is disrupted
- **THEN** no `country:news` incident is opened, because `news` is not incident-eligible even though `weather` now is
