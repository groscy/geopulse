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

### Requirement: GDELT per-country news signals
The `gdelt-worker` SHALL, in addition to its dyad tone output, aggregate each GDELT export window into per-country point observations for every country appearing as `Actor1` or `Actor2` with an ISO-3 country code, emitting `metric='news_tone'` (article-weighted mean `AvgTone`), `metric='news_goldstein'` (article-weighted mean `GoldsteinScale`), and `metric='news_volume'` (article/event coverage count), normalized to the canonical `Observation` shape with ISO-3 `country` and `source='gdelt'`. It SHALL require a minimum per-country article/event count before emitting, and SHALL leave its existing dyad `gdelt_tone` output unchanged.

#### Scenario: Per-country signals emitted
- **WHEN** the gdelt-worker processes an export window in which a country meets the minimum article/event count
- **THEN** it writes `news_tone`, `news_goldstein`, and `news_volume` point observations for that country, article-weighted, with `source='gdelt'`

#### Scenario: Domestic and single-actor events counted
- **WHEN** an event names a country as only one actor, or names it as both actors (a domestic event)
- **THEN** that event contributes to the country's per-country news signals, even though it is excluded from cross-border dyad tone

#### Scenario: Sparse window suppressed
- **WHEN** a country falls below the minimum per-country article/event count in a window
- **THEN** no per-country news observation is written for it in that window

#### Scenario: Dyad path unaffected
- **WHEN** the per-country aggregation runs
- **THEN** the existing `gdelt_tone` dyad observations are still written exactly as before

### Requirement: Weather worker
The `weather-worker` SHALL, on its own cadence, sample current conditions at a representative point (capital or centroid) for each tracked country from a keyless provider (Open-Meteo) in a single batched request, and emit point `Observation` rows normalized to the canonical shape with ISO-3 `country` and `source='open-meteo'` for each of `metric='weather_temp'` (2 m air temperature, °C), `metric='weather_precip'` (precipitation, mm), and `metric='weather_wind'` (10 m wind speed, km/h). Cloud cover SHALL NOT be fetched or stored by this worker (deferred to the Phase 3 field shell). It SHALL require no API key, respect a per-provider token bucket, and degrade gracefully — on quota exhaustion or upstream error it SHALL skip the cycle and leave the last-known observations in place rather than crashing or writing a bad value. When a returned point is missing an individual field, the worker SHALL emit the fields that are present and skip only the missing metric for that country.

#### Scenario: Temperatures emitted
- **WHEN** the weather-worker runs a cycle and Open-Meteo returns current conditions for the sampled points
- **THEN** it writes, per tracked country, a `weather_temp`, a `weather_precip`, and a `weather_wind` point observation with ISO-3 `country` and `source='open-meteo'`

#### Scenario: Cloud cover not ingested
- **WHEN** the weather-worker runs a cycle
- **THEN** no `weather_cloud` (or equivalent cloud-cover) observation is written, because cloud is deferred to the Phase 3 field shell

#### Scenario: Provider failure is non-fatal
- **WHEN** Open-Meteo is unavailable or the token bucket is empty
- **THEN** the worker skips the cycle, logs the deferral, and does not crash or overwrite the last-known values with a bad value

#### Scenario: Partial fields tolerated
- **WHEN** a returned point includes temperature but is missing precipitation or wind for a country
- **THEN** the worker writes the available metric(s) for that country and skips only the missing metric, without failing the batch

#### Scenario: Keyless operation
- **WHEN** no weather API key is configured
- **THEN** the weather-worker still runs and ingests temperature, precipitation, and wind (Open-Meteo requires no key)

### Requirement: Climatology normals ingestion
The system SHALL obtain day-of-year **climatological normals** (mean and standard deviation) for each tracked country's representative point, per weather metric, from a keyless provider (Open-Meteo climate normals), on a rare cadence appropriate to quasi-static data, and cache them in a store keyed by country, day-of-year, and metric. The normals store SHALL be isolated from the live `observation` hypertable, so that climatology (which has no live "freshness") does not affect the coverage/staleness math of live values. Fetching normals SHALL be keyless and degrade gracefully — an outage leaves the last-known normals in place.

#### Scenario: Normals fetched and cached
- **WHEN** the climatology fetch runs for the tracked points
- **THEN** it caches, per country/day-of-year/metric, a climatological mean and standard deviation, in a store separate from live observations

#### Scenario: Normals do not affect live coverage
- **WHEN** climatology normals are present
- **THEN** the per-country live coverage/staleness computation over `observation` is unchanged (normals are not live observations)

#### Scenario: Keyless and non-fatal
- **WHEN** no API key is configured or the normals provider is unavailable
- **THEN** the fetch still runs keyless, and on failure leaves the last-known normals in place without crashing

