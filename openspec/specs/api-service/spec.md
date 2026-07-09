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

