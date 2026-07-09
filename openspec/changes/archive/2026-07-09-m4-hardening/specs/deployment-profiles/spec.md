## ADDED Requirements

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
