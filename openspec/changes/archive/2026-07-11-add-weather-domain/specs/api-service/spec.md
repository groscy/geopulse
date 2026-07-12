## ADDED Requirements

### Requirement: Weather tiles endpoint
The API SHALL expose `GET /api/weather` returning, per tracked country, the 7-day mean surface temperature in °C (the mean of the country's `weather_temp` observations over the last 7 days) and the country's committed `weather` anomaly state, so the Meteorological overlay can render a data-backed temperature choropleth and reflect anomalies. Weather-domain incidents SHALL be served through the existing `/api/incidents` endpoints unchanged, and `/api/tiles` (the composite choropleth) SHALL remain unaffected.

#### Scenario: Weather endpoint returns per-country temperature and state
- **WHEN** a client requests `GET /api/weather`
- **THEN** it receives an array of `{country, tempC, state, ageMin}` entries where `tempC` is the country's 7-day mean temperature and `state` is its committed weather anomaly state

#### Scenario: Composite tiles unaffected
- **WHEN** the weather domain is scored and served
- **THEN** `GET /api/tiles` still returns only the composite state per country, unchanged by the presence of weather data
