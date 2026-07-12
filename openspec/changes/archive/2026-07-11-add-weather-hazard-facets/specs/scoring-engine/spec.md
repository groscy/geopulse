## MODIFIED Requirements

### Requirement: Weather domain scoring
The scoring engine SHALL score weather as three independent **single-metric facet domains** — `weather_temp`, `weather_precip`, and `weather_wind` — each rolled up from its one metric of the same name through the same self-relative z-score, per-metric τ, four-state mapping, and hysteresis rules as the other point-based domains, and SHALL persist each as a `score` row with `domain` equal to the facet name and a decomposable `inputs`. Because each facet domain contains exactly one metric, the domain z SHALL be that metric's z (there is no cross-hazard averaging). Each facet z SHALL be measured against the country's own recent baseline, yielding a per-country **anomaly** (unusual for that country), not an absolute-value threshold.

#### Scenario: Weather scored from temperature
- **WHEN** a country has sufficient baseline history for `weather_temp`, `weather_precip`, and `weather_wind`
- **THEN** three domain states (operational/degraded/disrupted) are computed and written, one per facet, each with an `inputs` record that decomposes back to its single metric, and no facet's state is affected by another facet's value

#### Scenario: Anomaly is self-relative
- **WHEN** a persistently-hot (or persistently-wet, or persistently-windy) country reports a value that is normal for that country
- **THEN** the corresponding facet is `operational` (near-zero z), because the anomaly is measured against the country's own baseline

#### Scenario: Weather stale on thin history
- **WHEN** a facet's metric has insufficient baseline or fresh coverage (below the coverage threshold)
- **THEN** that facet domain is marked `stale`, never collapsed into operational, independently of the other facets

### Requirement: Weather excluded from composite
The weather facet domains (`weather_temp`, `weather_precip`, `weather_wind`) SHALL NOT participate in the worst-of composite. The composite state SHALL continue to be computed from `markets`, `economy`, and `relations` only, so every weather signal is persisted and drives its own incidents but never alters a country's composite state.

#### Scenario: Heat anomaly does not worsen composite
- **WHEN** a country's `weather_precip` (or any weather facet) is disrupted while its markets, economy, and relations domains are operational
- **THEN** its composite remains operational, and the weather facet states are still persisted and available to the UI

## ADDED Requirements

### Requirement: Metric directionality
The scoring engine SHALL support per-metric **directionality** so that a one-sided hazard escalates only on its hazard tail. A metric configured `'both'` (e.g. `weather_temp`) SHALL escalate on either tail using `abs(z)`, as today. A metric configured `'high'` (e.g. `weather_precip`, `weather_wind`) SHALL escalate only on the positive tail: a negative z (the non-hazard side) SHALL map to `operational`. Directionality SHALL be applied in the four-state mapping, so that downstream hysteresis and incident logic continue to gate on the resulting `state` unchanged.

#### Scenario: One-sided low tail does not escalate
- **WHEN** `weather_wind` for a country has a strongly negative z (an unusually calm week)
- **THEN** its `weather_wind` facet is `operational`, and no wind incident is opened

#### Scenario: One-sided high tail escalates
- **WHEN** `weather_wind` for a country has a z of +2 or more (an unusually windy week)
- **THEN** its `weather_wind` facet reaches `disrupted` and is eligible to open a wind incident

#### Scenario: Two-sided metric escalates on either tail
- **WHEN** `weather_temp` for a country has a z of −2 or more in magnitude (an unusually cold week) or +2 or more (an unusually hot week)
- **THEN** its `weather_temp` facet reaches `disrupted` on either tail

### Requirement: Precipitation anomaly transform
The scoring engine SHALL compute the `weather_precip` anomaly on a variance-stabilizing transform of the baseline series (v1: `log1p` of millimetres) applied within the z-score computation, to tame the right-skewed, zero-inflated distribution of precipitation. The transform SHALL affect only the anomaly statistic; the raw millimetre observations SHALL remain unchanged in storage and SHALL be what the API and overlay display. The transform SHALL be monotonic so that the sign and ordering of the anomaly are preserved.

#### Scenario: Anomaly computed on transformed series
- **WHEN** `weather_precip` z is computed for a country
- **THEN** the baseline mean/standard-deviation and the latest-value z are computed over `log1p(mm)`, not raw mm

#### Scenario: Raw millimetres preserved for display
- **WHEN** the API or overlay reads `weather_precip` for display
- **THEN** it reads the raw millimetre observations (the transform is not persisted), so the choropleth shows real accumulation
