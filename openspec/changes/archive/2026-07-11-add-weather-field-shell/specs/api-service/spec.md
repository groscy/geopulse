## ADDED Requirements

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
