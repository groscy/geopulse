## MODIFIED Requirements

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
