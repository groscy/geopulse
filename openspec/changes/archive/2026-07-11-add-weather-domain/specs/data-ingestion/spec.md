## ADDED Requirements

### Requirement: Weather worker
The `weather-worker` SHALL, on its own cadence, sample current surface temperature at a representative point (capital or centroid) for each tracked country from a keyless provider (Open-Meteo), and emit `metric='weather_temp'` point `Observation` rows normalized to the canonical shape with ISO-3 `country` and `source='open-meteo'`. It SHALL require no API key, respect a per-provider token bucket, and degrade gracefully — on quota exhaustion or upstream error it SHALL skip the cycle and leave the last-known observation in place rather than crashing or writing a bad value.

#### Scenario: Temperatures emitted
- **WHEN** the weather-worker runs a cycle and Open-Meteo returns current temperatures for the sampled points
- **THEN** it writes one `weather_temp` point observation per tracked country, ISO-3 `country`, `source='open-meteo'`

#### Scenario: Provider failure is non-fatal
- **WHEN** Open-Meteo is unavailable or the token bucket is empty
- **THEN** the worker skips the cycle, logs the deferral, and does not crash or overwrite the last-known temperatures with a bad value

#### Scenario: Keyless operation
- **WHEN** no weather API key is configured
- **THEN** the weather-worker still runs and ingests temperatures (Open-Meteo requires no key)
