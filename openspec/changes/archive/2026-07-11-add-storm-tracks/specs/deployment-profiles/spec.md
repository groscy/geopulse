## ADDED Requirements

### Requirement: Storm worker in the stack
The `storm-worker` SHALL be registered as a service in the Docker Compose stack and the single-image supervisor, running in both the `lite` and `full` profiles, using the shared services image and its own command. It SHALL preserve the local-first invariant: its only egress SHALL be to the upstream NHC feed, with no dependency on any cloud backend.

#### Scenario: Storm worker runs in both profiles
- **WHEN** the stack is started with either the `lite` or the `full` profile
- **THEN** the `storm-worker` service starts and begins populating active storms and their incidents

#### Scenario: Local-first preserved
- **WHEN** the `storm-worker` runs
- **THEN** its only outbound connections are to the configured NHC endpoint, keeping the single-host, upstream-only-egress invariant
