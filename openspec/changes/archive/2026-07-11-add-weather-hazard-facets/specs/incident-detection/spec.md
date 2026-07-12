## MODIFIED Requirements

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
