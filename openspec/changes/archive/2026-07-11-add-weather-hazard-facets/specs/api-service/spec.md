## MODIFIED Requirements

### Requirement: Weather tiles endpoint
The API SHALL expose `GET /api/weather` returning, per tracked country, the three weather aggregates and their per-facet committed anomaly state in a single payload: the **7-day mean** surface temperature in °C (`tempC`), the **7-day total** precipitation in mm (`precipMm`), the **7-day maximum** wind speed in km/h (`windMax`), and the committed anomaly state of each facet (`weather_temp`/`weather_precip`/`weather_wind`), so the Meteorological overlay can render any of its switchable choropleth modes and reflect anomalies without refetching. Each aggregate SHALL be computed from the corresponding metric's raw observations over the last 7 days (precipitation summed, temperature averaged, wind taken as the maximum). Weather-facet incidents SHALL be served through the existing `/api/incidents` endpoints unchanged, and `/api/tiles` (the composite choropleth) SHALL remain unaffected.

#### Scenario: Weather endpoint returns per-country temperature and state
- **WHEN** a client requests `GET /api/weather`
- **THEN** it receives, per country, the 7-day mean temperature, 7-day total precipitation, and 7-day maximum wind, together with each facet's committed anomaly state and the reading age

#### Scenario: Aggregates use per-metric semantics
- **WHEN** the endpoint computes each aggregate
- **THEN** temperature is the 7-day mean, precipitation is the 7-day sum, and wind is the 7-day maximum, over the raw (untransformed) observations

#### Scenario: Missing facet degrades to stale, not error
- **WHEN** a country has temperature history but not yet enough precipitation or wind history
- **THEN** the endpoint still returns the country with the available aggregate(s) and reports the missing facet's state as `stale`, rather than omitting the country or failing

#### Scenario: Composite tiles unaffected
- **WHEN** the weather facets are scored and served
- **THEN** `GET /api/tiles` still returns only the composite state per country, unchanged by the presence of weather data
