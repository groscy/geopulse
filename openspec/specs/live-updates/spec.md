# live-updates Specification

## Purpose
TBD - created by archiving change m2-drilldown-incidents. Update Purpose after archive.
## Requirements
### Requirement: SSE update stream
The API SHALL expose `GET /api/stream` as a Server-Sent Events endpoint that pushes server→client events for (a) tile state diffs when a country's composite state changes and (b) incident lifecycle events (opened / resolved). The stream SHALL be the only live channel (no WebSockets, per ADR-004) and SHALL be auto-reconnecting on the client.

#### Scenario: Tile diff pushed
- **WHEN** a country's persisted composite state changes after a scoring cycle
- **THEN** the stream emits a `tile` event with the country code and new state

#### Scenario: Incident event pushed
- **WHEN** an incident is opened or resolved
- **THEN** the stream emits an `incident` event with the incident id and its new status

### Requirement: Client applies diffs without full reload
The frontend SHALL subscribe to the stream on load and apply tile and incident diffs to in-memory state, updating the globe coloring, top-bar counts, incident feed, and freshness indicator without re-fetching the full tile set.

#### Scenario: Live recolor
- **WHEN** a `tile` event arrives changing JPN to disrupted
- **THEN** Japan recolors on the globe and the top-bar counts adjust, with no full page reload

#### Scenario: Reconnect after drop
- **WHEN** the SSE connection drops
- **THEN** the client automatically reconnects and reconciles current state via a tiles refetch

### Requirement: Freshness indicator
The top bar SHALL show a live freshness indicator ("Live · updated Ns ago") driven by the stream, incrementing each second and resetting when a new update arrives.

#### Scenario: Freshness resets on update
- **WHEN** a stream event arrives
- **THEN** the "updated Ns ago" counter resets to 0 and resumes incrementing

