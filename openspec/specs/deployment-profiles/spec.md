# deployment-profiles Specification

## Purpose
TBD - created by archiving change m4-hardening. Update Purpose after archive.
## Requirements
### Requirement: Lite and full Compose profiles
The stack SHALL define Docker Compose profiles: a `lite` profile bringing up the database, a minimal worker set (at least markets + GDELT), scoring, api, and frontend; and a `full` profile bringing up all workers (markets, fx, gdelt, macro, and conflict if present). Selecting a profile SHALL start exactly that service set.

#### Scenario: Lite bring-up
- **WHEN** the stack is started with the `lite` profile
- **THEN** only the lite service set starts, and the globe renders composite health from the reduced sources

#### Scenario: Full bring-up
- **WHEN** the stack is started with the `full` profile
- **THEN** all workers start and all domains are fed

### Requirement: Profiles are documented and reproducible
The profiles SHALL be documented (README/`.env.example`) with the sources each includes and the host resources each expects, so an operator can choose a profile for a constrained host vs a full workstation.

#### Scenario: Operator chooses a profile
- **WHEN** an operator reads the deployment docs
- **THEN** they can tell which services and sources each profile runs and start the appropriate one with a single command

### Requirement: Local-first invariant preserved
Both profiles SHALL keep the local-first invariant: the entire stack runs on one host and the only egress is to upstream public data APIs (NFR-1).

#### Scenario: No cloud dependency
- **WHEN** either profile is running
- **THEN** no service depends on a cloud backend, and outbound connections are only to the configured public data providers

### Requirement: Weather field worker in the stack
The `weather-field-worker` SHALL be registered as a service in the Docker Compose stack and SHALL run in both the `lite` and `full` profiles, using the shared services image and its own command, so the atmospheric field is populated wherever the stack runs. It SHALL preserve the local-first invariant: its only egress SHALL be to the upstream Open-Meteo API, with no dependency on any cloud backend.

#### Scenario: Field worker runs in both profiles
- **WHEN** the stack is started with either the `lite` or the `full` profile
- **THEN** the `weather-field-worker` service starts and begins populating the atmospheric field grid

#### Scenario: Local-first preserved
- **WHEN** the `weather-field-worker` runs
- **THEN** its only outbound connections are to the configured Open-Meteo endpoint, keeping the single-host, upstream-only-egress invariant

### Requirement: Storm worker in the stack
The `storm-worker` SHALL be registered as a service in the Docker Compose stack and the single-image supervisor, running in both the `lite` and `full` profiles, using the shared services image and its own command. It SHALL preserve the local-first invariant: its only egress SHALL be to the upstream NHC feed, with no dependency on any cloud backend.

#### Scenario: Storm worker runs in both profiles
- **WHEN** the stack is started with either the `lite` or the `full` profile
- **THEN** the `storm-worker` service starts and begins populating active storms and their incidents

#### Scenario: Local-first preserved
- **WHEN** the `storm-worker` runs
- **THEN** its only outbound connections are to the configured NHC endpoint, keeping the single-host, upstream-only-egress invariant

