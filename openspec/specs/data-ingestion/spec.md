# data-ingestion Specification

## Purpose
TBD - created by archiving change m1-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Worker normalization contract
Every ingestion worker SHALL normalize its upstream data into the canonical `Observation` shape `(country, metric, value, ts, source, confidence)` before writing to the store, so that downstream scoring is source-agnostic. Country codes SHALL be ISO 3166-1 alpha-3.

#### Scenario: Provider payload normalized
- **WHEN** a worker receives a provider-specific payload for an index quote
- **THEN** it emits one or more `Observation` rows with a canonical `metric` name, ISO-3 `country`, source-attributed `source`, and a `confidence` in [0,1]

### Requirement: Independent scheduler per worker
Each worker SHALL run its own scheduler on its source family's cadence, independent of other workers, so a slow or failing source does not block others. M1 cadences: markets ≤ 5 min, GDELT 15 min.

#### Scenario: Markets polls on cadence
- **WHEN** the markets-worker is running
- **THEN** it fetches its index set at least once every 5 minutes and writes fresh observations

### Requirement: Per-provider rate limiting
Workers SHALL respect provider quotas using a token-bucket limiter per provider, and SHALL degrade gracefully — on quota exhaustion or upstream error, the worker SHALL skip the cycle and leave the last-known observation in place rather than raising a fatal error or writing a bad value.

#### Scenario: Quota exhausted
- **WHEN** the configured token bucket for a provider is empty
- **THEN** the worker defers the request, logs the deferral, and does not crash

### Requirement: Markets worker
The `markets-worker` SHALL ingest daily/last quotes for at least 10 major equity indices via a primary provider (Finnhub or Twelve Data) with a Stooq EOD fallback, writing them as `metric='equity_index'` observations. On primary-provider failure it SHALL fall back to Stooq and mark the observation `confidence` lower.

#### Scenario: Primary succeeds
- **WHEN** the primary provider returns quotes for the index set
- **THEN** 10+ `equity_index` observations are written with full confidence

#### Scenario: Fallback to Stooq
- **WHEN** the primary provider is unavailable
- **THEN** the worker fetches EOD values from Stooq and writes them with reduced confidence and `source='stooq'`

### Requirement: GDELT worker
The `gdelt-worker` SHALL ingest GDELT 2.0 average tone at country-dyad level on a 15-minute cadence and write `dyad_observation` rows with `metric='gdelt_tone'`. It SHALL require a minimum event count per window before emitting a dyad tone, to avoid scoring noise.

#### Scenario: Sufficient events
- **WHEN** a country pair has at least the configured minimum events in the window
- **THEN** the worker writes one `gdelt_tone` dyad observation for that pair

#### Scenario: Insufficient events
- **WHEN** a country pair falls below the minimum event count
- **THEN** no tone observation is written for that pair in that window

