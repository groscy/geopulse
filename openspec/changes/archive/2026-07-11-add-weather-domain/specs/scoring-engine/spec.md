## ADDED Requirements

### Requirement: Weather domain scoring
The scoring engine SHALL compute a `weather` domain per country as a staleness-discounted weighted rollup of its weather metric(s) (v1: `weather_temp`), using the same self-relative z-score, per-metric weight/τ, four-state mapping, and hysteresis rules as the other point-based domains, and SHALL persist it as a `score` row with `domain='weather'` and a decomposable `inputs`. The z-score against the country's own recent baseline SHALL yield a per-country temperature **anomaly** (hotter or colder than that country's own normal), not an absolute-temperature threshold.

#### Scenario: Weather scored from temperature
- **WHEN** a country has sufficient baseline history for `weather_temp`
- **THEN** a `weather` domain state (operational/degraded/disrupted) is computed from the self-relative z-score and written with an `inputs` record that decomposes back to `weather_temp`

#### Scenario: Anomaly is self-relative
- **WHEN** a persistently-hot country reports a temperature that is normal for that country
- **THEN** its `weather` domain is `operational` (near-zero z), not disrupted, because the anomaly is measured against the country's own baseline

#### Scenario: Weather stale on thin history
- **WHEN** a country's `weather_temp` has insufficient baseline or fresh coverage (below the coverage threshold)
- **THEN** the `weather` domain is marked `stale`, never collapsed into operational

### Requirement: Weather excluded from composite
The `weather` domain SHALL NOT participate in the worst-of composite. The composite state SHALL continue to be computed from `markets`, `economy`, and `relations` only, so the weather signal is persisted and drives its own incidents but never alters a country's composite state.

#### Scenario: Heat anomaly does not worsen composite
- **WHEN** a country's `weather` domain is disrupted while its markets, economy, and relations domains are operational
- **THEN** its composite remains operational, and the `weather` domain state is still persisted and available to the UI
