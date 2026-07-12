## ADDED Requirements

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
