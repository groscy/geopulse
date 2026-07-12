## ADDED Requirements

### Requirement: Weather field worker in the stack
The `weather-field-worker` SHALL be registered as a service in the Docker Compose stack and SHALL run in both the `lite` and `full` profiles, using the shared services image and its own command, so the atmospheric field is populated wherever the stack runs. It SHALL preserve the local-first invariant: its only egress SHALL be to the upstream Open-Meteo API, with no dependency on any cloud backend.

#### Scenario: Field worker runs in both profiles
- **WHEN** the stack is started with either the `lite` or the `full` profile
- **THEN** the `weather-field-worker` service starts and begins populating the atmospheric field grid

#### Scenario: Local-first preserved
- **WHEN** the `weather-field-worker` runs
- **THEN** its only outbound connections are to the configured Open-Meteo endpoint, keeping the single-host, upstream-only-egress invariant
