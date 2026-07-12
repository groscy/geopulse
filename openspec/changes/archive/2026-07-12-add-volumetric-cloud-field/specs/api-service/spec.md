## ADDED Requirements

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
