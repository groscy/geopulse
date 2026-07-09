## ADDED Requirements

### Requirement: Continuous aggregates for hot rollups
The store SHALL define TimescaleDB continuous aggregates for the rollups the scoring engine and UI read repeatedly (e.g. per-country per-metric rolling statistics used for baselines), so those reads do not rescan the raw hypertable each cycle.

#### Scenario: Baseline read served from aggregate
- **WHEN** the scoring engine computes a country's 90-day baseline
- **THEN** it reads from a continuous aggregate rather than a full scan of raw observations, and the aggregate refreshes on its policy

### Requirement: 90-day retention on high-frequency raw data
The store SHALL apply retention policies that drop high-frequency raw observations older than 90 days while preserving the continuous aggregates and lower-frequency structural/macro metrics needed for context.

#### Scenario: Old raw data dropped
- **WHEN** raw high-frequency observations age past 90 days
- **THEN** they are removed by the retention policy, and the corresponding aggregates remain available

#### Scenario: Structural data preserved
- **WHEN** retention runs
- **THEN** slow-cadence structural/macro metrics are retained beyond the high-frequency window per their own policy

### Requirement: Retention and aggregates are reproducible
Continuous aggregates and retention policies SHALL be defined in checked-in migrations so a fresh bring-up reproduces them without manual SQL.

#### Scenario: Fresh bring-up includes policies
- **WHEN** the stack is started on a clean volume
- **THEN** the aggregates and retention policies are created by migrations alongside the base tables
