## ADDED Requirements

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
