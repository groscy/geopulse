# score-stability Specification

## Purpose
TBD - created by archiving change m4-hardening. Update Purpose after archive.
## Requirements
### Requirement: Backfill replay harness
The system SHALL provide a mode that loads a 90-day historical backfill and replays the scoring engine over it deterministically, so hysteresis behavior can be measured and tuned against real history rather than live data.

#### Scenario: Replay produces a state timeline
- **WHEN** the backfill is loaded and scoring is replayed
- **THEN** the harness produces a per-country state timeline that can be inspected for flapping

### Requirement: Flap-rate measurement and tuning
The harness SHALL measure a flap rate (state transitions per country per unit time) over the replay, and the hysteresis parameters (N-hold, enter |z|=1.0, recover |z|=0.7) SHALL be tuned so the flap rate is low WITHOUT masking sustained genuine transitions. The chosen defaults SHALL be committed to config.

#### Scenario: Tuning reduces flapping
- **WHEN** parameters are tuned against the backfill
- **THEN** the measured flap rate drops relative to the untuned baseline while known sustained events still register as transitions

#### Scenario: Genuine event still registers
- **WHEN** the backfill contains a sustained multi-day disruption
- **THEN** the tuned engine still transitions that country to disrupted (it is not smoothed away)

### Requirement: Regression guard on stability
The tuned flap-rate result SHALL be captured as a regression check so future scoring changes that reintroduce flapping are caught.

#### Scenario: Regression detected
- **WHEN** a scoring change increases the replay flap rate beyond the accepted threshold
- **THEN** the stability check fails, flagging the regression

