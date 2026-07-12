# weather-field Specification

## Purpose
TBD - created by archiving change add-weather-field-shell. Update Purpose after archive.
## Requirements
### Requirement: Global atmospheric field worker
A `weather-field-worker` SHALL, on its own slow cadence, fetch a coarse **global grid** of current atmospheric field values from a keyless provider (Open-Meteo) in one or a small number of batched requests, and cache the latest grid as a **single blob**, overwriting it each cycle. For each grid node it SHALL capture cloud cover (%), a wind vector (10 m wind stored as `u`/`v` components derived from wind speed and direction), and precipitation (mm), tagged with the node's latitude/longitude and a fetch timestamp. The worker SHALL require no API key, respect a per-provider token bucket, and degrade gracefully — on quota exhaustion or upstream error it SHALL skip the cycle and leave the last-known grid in place rather than crashing or writing a bad blob.

#### Scenario: Field grid fetched and cached
- **WHEN** the weather-field-worker runs a cycle and Open-Meteo returns current conditions for the grid nodes
- **THEN** it writes a single cached grid blob containing, per node, its latitude/longitude, cloud cover %, wind `u`/`v` components, and precipitation, with a fetch timestamp, overwriting the previous blob

#### Scenario: Slow cadence, single blob
- **WHEN** consecutive cycles run
- **THEN** only the one latest grid blob is retained (each cycle overwrites the prior), rather than accumulating per-node history

#### Scenario: Provider failure is non-fatal
- **WHEN** Open-Meteo is unavailable or the token bucket is empty
- **THEN** the worker skips the cycle, logs the deferral, and leaves the last cached grid in place without crashing

#### Scenario: Keyless operation
- **WHEN** no weather API key is configured
- **THEN** the weather-field-worker still runs and fetches the field grid (Open-Meteo requires no key)

### Requirement: Field data is isolated from the scoring spine
The atmospheric field SHALL be an ambient visualization layer only, with **no country, no baseline, no z-score, and no state**. It SHALL NOT be written to the per-country `observation` store, SHALL NOT be rolled into any scored domain, SHALL NOT affect the worst-of composite, and SHALL NOT be an incident source. The field's storage SHALL be a store isolated from `observation`, `score`, and `incident`, so that adding or removing the field leaves the scoring pipeline unchanged.

#### Scenario: Field never enters scoring
- **WHEN** the field grid is fetched and cached
- **THEN** no `observation` row, `score` row, or `incident` is created from it, and per-country scoring queries are unaffected by its presence

#### Scenario: Field is additive and removable
- **WHEN** the atmospheric field feature is disabled or its store is dropped
- **THEN** the temperature/precipitation/wind facets, `/api/weather`, incidents, and the worst-of composite continue to function unchanged

#### Scenario: Cloud cover lives only in the field
- **WHEN** cloud cover is ingested
- **THEN** it appears only in the field grid (never as a per-country `weather_cloud` observation or a scored anomaly), because cloud is a field quantity, not a point hazard

### Requirement: Finer packed field grid
The atmospheric field MAY be sampled on a **finer grid** (a smaller step than the coarse default) for greater spatial detail, and the cached grid SHALL be serializable in a **packed columnar** form — grid dimensions (latitude/longitude extent, step, counts) plus flat per-channel arrays (`cloud`, `u`, `v`, `precip`) — from which node positions are reconstructed, rather than only an array of per-node objects. The packed form SHALL carry the same information as the per-node form and SHALL be the default at fine resolution so the payload and decode stay cheap. The worker SHALL still fetch the finer grid in batched keyless requests on the slow cadence and cache one blob, unchanged in isolation from the scoring spine.

#### Scenario: Finer grid fetched and cached
- **WHEN** the field worker runs with a finer step
- **THEN** it fetches the denser grid in batched requests and caches one blob, still isolated from `observation`/`score`

#### Scenario: Packed columnar form is equivalent
- **WHEN** the field is serialized in the packed columnar form
- **THEN** the client reconstructs the same per-node cloud/wind/precip field it would from the per-node form, at lower payload and decode cost

