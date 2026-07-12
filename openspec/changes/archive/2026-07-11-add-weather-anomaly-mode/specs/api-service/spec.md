## ADDED Requirements

### Requirement: Weather anomaly z in the weather endpoint
`GET /api/weather` SHALL additionally return, per country, each facet's signed **anomaly z** (`weather_temp`, `weather_precip`, `weather_wind`) drawn from the facet's persisted `score` row, so the Meteorological overlay can color land by the per-country anomaly without recomputation or a refetch. The z SHALL be null where the facet is stale (no trustworthy anomaly yet). Exposing the z SHALL NOT change the existing aggregates or states in the payload, and SHALL NOT alter any other endpoint.

#### Scenario: Endpoint returns per-facet anomaly z
- **WHEN** a client requests `GET /api/weather`
- **THEN** each country additionally carries the signed anomaly z for temperature, precipitation, and wind (null where a facet is stale), alongside the existing aggregates and states

#### Scenario: Anomaly z reflects the scored anomaly
- **WHEN** a facet's committed state is disrupted on the high tail
- **THEN** that facet's returned z has magnitude at or above the disrupted threshold and the correct sign, matching the score that drove the state

#### Scenario: No recomputation or payload regression
- **WHEN** the z is included
- **THEN** the aggregates (`tempC`/`precipMm`/`windMax`) and `states` are unchanged, and `/api/tiles`, `/api/incidents`, `/api/weather-field` are unaffected
