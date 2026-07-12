# api-service Specification

## Purpose
TBD - created by archiving change m1-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Composite tiles endpoint
The API SHALL expose `GET /api/tiles` returning, for every country with a computed score, its ISO-3 code, composite state, composite value, and `computed_at`, so the frontend can color the globe in a single request.

#### Scenario: Globe fetches tiles
- **WHEN** the frontend requests `GET /api/tiles`
- **THEN** it receives a JSON array of `{ country, state, value, computed_at }` covering all scored countries

#### Scenario: Unscored country omitted or stale
- **WHEN** a country has no score yet (no data / warm-up)
- **THEN** it is either omitted or returned with `state: "stale"`, never returned as `operational` by default

### Requirement: Country breakdown endpoint
The API SHALL expose `GET /api/countries/{iso3}` returning the country's composite state, its per-domain states and values, and the contributing metric observations (`metric, value, source, ts`) drawn from the score's `inputs`, so the score is auditable through the API.

#### Scenario: Drill query
- **WHEN** the frontend requests `GET /api/countries/JPN`
- **THEN** it receives the composite state, per-domain states, and the underlying metric observations with source and timestamp

#### Scenario: Unknown country
- **WHEN** a request uses an ISO-3 code that has no data
- **THEN** the API responds 404 (or a documented empty payload), not a fabricated score

### Requirement: Read-only, CORS-enabled, documented
The M1 API SHALL be read-only, SHALL enable CORS for the local frontend origin, and SHALL publish an OpenAPI schema (FastAPI default) for the exposed endpoints.

#### Scenario: Frontend cross-origin read
- **WHEN** the Vite dev server calls the API from a different local port
- **THEN** the request succeeds under the configured CORS policy

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

### Requirement: Atmospheric field endpoint
The API SHALL expose `GET /api/weather-field` returning the cached global atmospheric field in a single response: grid metadata (spacing/extent/dimensions and the field's fetch timestamp and age) together with the per-node values (latitude, longitude, cloud cover %, wind `u`/`v` components, and precipitation), so the Meteorological overlay can render the atmospheric shell from one fetch and re-render client-side without refetching. The endpoint SHALL be read-only and CORS-enabled. Serving the field SHALL NOT alter `GET /api/tiles`, `GET /api/weather`, or the `GET /api/incidents` endpoints.

#### Scenario: Field endpoint returns the grid
- **WHEN** a client requests `GET /api/weather-field`
- **THEN** it receives the grid metadata and the per-node cloud/wind/precip values in one payload, with the field's age

#### Scenario: Field absent before first fetch
- **WHEN** no field grid has been cached yet (worker warm-up)
- **THEN** the endpoint returns an empty/absent field payload rather than fabricating values or failing

#### Scenario: Other endpoints unaffected
- **WHEN** the atmospheric field is served
- **THEN** `GET /api/tiles`, `GET /api/weather`, and `GET /api/incidents` return their existing payloads unchanged

### Requirement: Storms endpoint
The API SHALL expose `GET /api/storms` returning the current active-storm set from the cached blob in a single response: per storm its id, name, basin, current position (lat/lon), category/intensity, and forecast track points, plus the fetch age. The endpoint SHALL be read-only and CORS-enabled, and SHALL return an empty list when no storms are active or before the worker's first fetch. Serving storms SHALL NOT alter `GET /api/tiles`, `GET /api/weather`, `GET /api/weather-field`, or `GET /api/incidents`.

#### Scenario: Storms endpoint returns active systems
- **WHEN** a client requests `GET /api/storms`
- **THEN** it receives the active storms with position, category, name, and track, plus the reading age

#### Scenario: No active storms
- **WHEN** no storms are active (or the worker has not fetched yet)
- **THEN** the endpoint returns an empty list rather than failing

#### Scenario: Other endpoints unaffected
- **WHEN** storms are served
- **THEN** `GET /api/tiles`, `GET /api/weather`, `GET /api/weather-field`, and `GET /api/incidents` return their existing payloads unchanged

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

### Requirement: Weather facets in the country breakdown
`GET /api/countries/{iso3}` SHALL additionally return the country's **weather facets** as auditable rows: for each scored weather facet (`weather_temp`, `weather_precip`, `weather_wind`, and any further facet such as `weather_drought`), its committed state, its latest aggregate value (7-day mean °C / total mm / max km/h) with unit, its signed anomaly z, the reading age, and a recent series — drawn from the facet's `score` row and raw observations. The set SHALL include whatever weather facets have a score for the country (not a hardcoded list), so new facets appear automatically. The weather section SHALL be marked standalone (not part of the composite). All existing fields of the endpoint SHALL be unchanged.

#### Scenario: Drill query returns weather facets
- **WHEN** the frontend requests `GET /api/countries/JPN`
- **THEN** the response includes a weather section listing each scored facet's state, latest value with unit, anomaly z, and age, alongside the existing domains and metrics

#### Scenario: New facets appear automatically
- **WHEN** a country has a `weather_drought` score in addition to temp/precip/wind
- **THEN** the drought facet is included in the weather section without an endpoint change

#### Scenario: Existing breakdown unchanged
- **WHEN** the weather section is added
- **THEN** the composite, per-domain states, standard metrics, news metrics, relations, and incidents in the payload are unchanged, and the weather section is marked standalone

### Requirement: Packed field payload
`GET /api/weather-field` SHALL be able to serve the atmospheric field in a **packed columnar** form — grid dimensions (extent, step, counts) plus flat per-channel arrays (`cloud`, `u`, `v`, `precip`) — in one response with the field age, so a finer grid stays small over the wire and fast to decode. The packed form SHALL be information-equivalent to the per-node form, and serving it SHALL NOT alter `GET /api/tiles`, `GET /api/weather`, or `GET /api/incidents`.

#### Scenario: Endpoint serves the packed grid
- **WHEN** a client requests `GET /api/weather-field` at fine resolution
- **THEN** it receives the grid dimensions plus flat cloud/wind/precip arrays and the field age, from which it reconstructs the field

#### Scenario: Empty before warm-up
- **WHEN** no field grid has been cached yet
- **THEN** the endpoint returns an empty/absent field payload rather than failing

#### Scenario: Other endpoints unaffected
- **WHEN** the packed field is served
- **THEN** `GET /api/tiles`, `GET /api/weather`, and `GET /api/incidents` return their existing payloads unchanged

