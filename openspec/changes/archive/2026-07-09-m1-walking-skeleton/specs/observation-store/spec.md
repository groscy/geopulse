## ADDED Requirements

### Requirement: Observation hypertable
The system SHALL persist point observations in an `observation` table with columns `country char(3)`, `metric text`, `value double precision`, `ts timestamptz`, `source text`, `confidence real`, and a primary key of `(country, metric, ts, source)`. The table SHALL be a TimescaleDB hypertable partitioned on `ts`.

#### Scenario: Worker writes an observation
- **WHEN** a worker inserts `(country='JPN', metric='equity_index', value=38204, ts=<now>, source='finnhub', confidence=1.0)`
- **THEN** the row is stored in the hypertable and is retrievable by `(country, metric)` ordered by `ts`

#### Scenario: Idempotent re-fetch
- **WHEN** the same `(country, metric, ts, source)` tuple is written twice
- **THEN** the write is an upsert (ON CONFLICT DO UPDATE) and does not create a duplicate row

### Requirement: Dyad observation table
The system SHALL persist directional/bilateral observations in a `dyad_observation` table with columns `country_a char(3)`, `country_b char(3)`, `metric text`, `value double precision`, `ts timestamptz`, `source text`, so that relation metrics such as `gdelt_tone` can be stored per country pair.

#### Scenario: GDELT tone stored per dyad
- **WHEN** the gdelt-worker writes tone for the pair `(country_a='USA', country_b='CHN', metric='gdelt_tone', value=-1.4, ts=<now>, source='gdelt')`
- **THEN** the row is queryable for that ordered pair and window

### Requirement: Schema migrations
Database schema SHALL be created and versioned through checked-in migration files applied at stack startup, so the store is reproducible on a fresh machine with no manual SQL.

#### Scenario: Fresh bring-up
- **WHEN** the stack is started on a machine with an empty database volume
- **THEN** migrations run automatically and create the hypertables, indexes, and TimescaleDB extension before any worker writes
