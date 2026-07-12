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

### Requirement: Weather anomaly incidents
The engine SHALL open **per-facet** weather incidents for the standalone weather facet domains (`weather_temp`, `weather_precip`, `weather_wind`) when a country's committed facet state reaches that facet's configured incident floor (v1: `disrupted`, |z| ≥ 2), keyed `country:<facet>` (e.g. `country:weather_precip`), reusing the existing incident schema, dedup, and resolution lifecycle. Incident titles SHALL name the facet and, where two-sided, its direction: `weather_temp` → "heat anomaly" (z > 0) or "cold anomaly" (z < 0); `weather_precip` → "flood risk"; `weather_wind` → "wind event". Incident-eligibility SHALL remain decoupled from worst-of-composite membership, so the weather facets open incidents while the `news` domain (also excluded from the composite) remains incident-free.

#### Scenario: Flood risk opens a precip incident
- **WHEN** a country's committed `weather_precip` state reaches its incident floor (disrupted)
- **THEN** exactly one `country:weather_precip` incident is opened titled "{country} · flood risk", with the triggering `weather_precip` decomposition in `detail`, without duplicating an already-open one

#### Scenario: Wind event opens a wind incident
- **WHEN** a country's committed `weather_wind` state reaches its incident floor (disrupted) on the high tail
- **THEN** exactly one `country:weather_wind` incident is opened titled "{country} · wind event"

#### Scenario: Heat/cold anomaly opens an incident
- **WHEN** a country's committed `weather_temp` state reaches its incident floor (disrupted)
- **THEN** exactly one `country:weather_temp` incident is opened, titled "{country} · heat anomaly" when z > 0 and "{country} · cold anomaly" when z < 0

#### Scenario: Anomaly recovery resolves the incident
- **WHEN** a country's `weather_precip` recovers below its floor under the hysteresis recovery rule while its `weather_temp` remains disrupted
- **THEN** the `country:weather_precip` incident's `resolved_at` is set while the `country:weather_temp` incident stays open

#### Scenario: Calm week opens no wind incident
- **WHEN** a country's `weather_wind` z is strongly negative (an unusually calm week)
- **THEN** no `country:weather_wind` incident is opened, because the one-sided facet is operational on the low tail

#### Scenario: News remains incident-free
- **WHEN** a country's `news` domain is disrupted
- **THEN** no `country:news` incident is opened, because `news` is not incident-eligible even though the weather facets are

### Requirement: Storm incidents
The engine SHALL open a `country:storm` incident for each tracked country threatened by an active tropical cyclone, with severity derived from the storm's Saffir-Simpson category (higher categories map to `disrupted`, weaker systems to `degraded`), reusing the existing incident schema, dedup, and resolution lifecycle. The incident `detail` SHALL carry the storm's name, category, and position. When a country is threatened by more than one active storm, the incident SHALL reflect the most severe. A `country:storm` incident SHALL be resolved when no active storm threatens that country (the storm dissipated or moved beyond the resolve-distance threshold). Storm incidents SHALL be produced independently of the worst-of composite membership, exactly as the weather-facet incidents are.

#### Scenario: Active storm opens a storm incident
- **WHEN** an active cyclone threatens a tracked country at or above the severity floor
- **THEN** exactly one `country:storm` incident is opened, titled for the storm and country, with the storm name/category/position in `detail`, without duplicating an already-open one

#### Scenario: Severity follows category
- **WHEN** a threatening storm is a major hurricane (high category) versus a weak tropical system
- **THEN** the storm incident's severity is `disrupted` for the major system and `degraded` for the weak one

#### Scenario: Storm incident resolves when the threat clears
- **WHEN** no active storm threatens a country any longer (dissipated or departed beyond the resolve distance)
- **THEN** that country's `country:storm` incident `resolved_at` is set

#### Scenario: Composite unaffected by storm incidents
- **WHEN** a `country:storm` incident is open while the country's scored domains are operational
- **THEN** the country's composite state is unchanged, because storms are not a scored domain

### Requirement: Drought incidents
The engine SHALL open a `country:weather_drought` incident when a country's committed `weather_drought` state reaches its configured incident floor (disrupted), titled "{country} · drought", reusing the existing incident schema, dedup, and resolution lifecycle, and independent of worst-of-composite membership. It SHALL resolve independently when the deficit recovers under the hysteresis recovery rule. Flood (`weather_precip`), wind, and heat/cold incidents SHALL be unchanged.

#### Scenario: Drought opens a drought incident
- **WHEN** a country's committed `weather_drought` state reaches its incident floor (disrupted)
- **THEN** exactly one `country:weather_drought` incident is opened, titled "{country} · drought", with the deficit decomposition in `detail`

#### Scenario: Independent drought resolution
- **WHEN** a country's `weather_drought` recovers below its floor under the hysteresis recovery rule while another facet stays disrupted
- **THEN** the `country:weather_drought` incident's `resolved_at` is set while the other facet's incident stays open

#### Scenario: Wet period opens no drought incident
- **WHEN** a country's precipitation is at or above its climatological normal
- **THEN** no `country:weather_drought` incident is opened, because the facet is one-sided (deficit only)

