# scoring-engine Specification

## Purpose
TBD - created by archiving change m1-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Per-country z-scores
The scoring engine SHALL compute, for each metric, a z-score `z = (x − μ) / σ` against that country's OWN rolling baseline (up to 90 days), never against a global cross-country distribution. z-scores SHALL be clamped to ±4 before rollup.

#### Scenario: Self-relative scoring
- **WHEN** two countries each move their equity index 2% but have different historical volatilities
- **THEN** the resulting z-scores differ, reflecting each country's own baseline rather than a shared scale

#### Scenario: Clamping outliers
- **WHEN** a raw z-score exceeds ±4
- **THEN** it is clamped to ±4 before being used in a domain rollup

### Requirement: Domain rollups
The engine SHALL compute a domain score per domain (M1: `markets`, `relations`) as a staleness-discounted weighted mean of that domain's clamped z-scores, using per-metric weights from config and a staleness discount `weight × exp(−age / τ_metric)`.

#### Scenario: Stale metric down-weighted
- **WHEN** a metric's most recent observation is old relative to its τ
- **THEN** its contribution to the domain score is exponentially discounted by age

### Requirement: Worst-of composite state
The engine SHALL compute a country's composite as the WORST of its available domain states (operational < degraded < disrupted), mirroring the AWS "as healthy as its worst subsystem" model, and SHALL persist per-domain states alongside the composite.

#### Scenario: One bad domain dominates
- **WHEN** a country is operational on markets but disrupted on relations
- **THEN** its composite state is disrupted, and both domain states are retained

### Requirement: Four-state mapping and staleness
The engine SHALL map a domain z to a state: `|z| < 1 → operational`, `1 ≤ |z| < 2 → degraded`, `|z| ≥ 2 → disrupted`; and SHALL mark a domain `stale` when effective data coverage is below 50% (e.g. a country with insufficient baseline history or too few fresh inputs). Stale SHALL be a distinct state, never collapsed into operational.

#### Scenario: Insufficient coverage
- **WHEN** a country has fewer fresh inputs than the coverage threshold requires
- **THEN** the affected domain and, if it is the worst, the composite are marked `stale`

### Requirement: Auditable score records
Each computed score SHALL be written to a `score` table with `(country, domain, value, state, computed_at, inputs jsonb)`, where `inputs` decomposes the score back to the contributing `(metric, value, source, ts, z, weight)` tuples so any state is fully explainable.

#### Scenario: Score decomposition
- **WHEN** a composite state is written for a country
- **THEN** its `inputs` jsonb lets a reviewer trace composite → domain scores → z-scores → raw `(value, source, timestamp)`

### Requirement: News domain scoring
The scoring engine SHALL compute a `news` domain per country as a staleness-discounted weighted rollup of its per-country news metrics (`news_tone`, `news_goldstein`, `news_volume`), using the same z-score, per-metric weight/τ, four-state mapping, and hysteresis rules as the other point-based domains, and SHALL persist it as a `score` row with `domain='news'` and a decomposable `inputs`.

#### Scenario: News scored from point metrics
- **WHEN** a country has sufficient baseline history for its news metrics
- **THEN** a `news` domain state (operational/degraded/disrupted) is computed from the weighted z-scores and written with an `inputs` record that decomposes back to the contributing metrics

#### Scenario: News stale on thin coverage
- **WHEN** a country's news metrics have insufficient baseline or fresh coverage (below the coverage threshold)
- **THEN** the `news` domain is marked `stale`, never collapsed into operational

### Requirement: News excluded from composite
The `news` domain SHALL NOT participate in the worst-of composite. The composite state SHALL continue to be computed from `markets`, `economy`, and `relations` only, so the news signal is selectable and persisted but never alters a country's composite state.

#### Scenario: Bad news does not worsen composite
- **WHEN** a country's `news` domain is disrupted while its markets, economy, and relations domains are operational
- **THEN** its composite remains operational, and the `news` domain state is still persisted and available to the UI

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

### Requirement: Day-of-year climatology baseline
The scoring engine SHALL support a per-metric **day-of-year climatology** baseline: for a facet using this mode, the latest value's z SHALL be measured against the country's climatological mean and standard deviation for the current day-of-year (over a smoothing window of ±N days), rather than a flat recent-window mean. Where a climatological normal is unavailable for a country/metric (warm-up or unsupported), the engine SHALL fall back to the existing recent self-window baseline, so a facet is never blanked by the new mode. The transform SHALL affect only the anomaly statistic; raw observations remain unchanged.

#### Scenario: Anomaly measured against the seasonal normal
- **WHEN** a facet with the climatology baseline is scored for a country that has a day-of-year normal
- **THEN** its z is computed against the climatological mean/σ for this time of year, removing the seasonal drift of a flat recent window

#### Scenario: Fallback when no normal exists
- **WHEN** a country/metric has no climatological normal yet
- **THEN** the facet is scored against the existing recent self-window baseline instead, without failing

### Requirement: Percentile precipitation anomaly
The scoring engine SHALL compute the `weather_precip` anomaly as an **empirical-CDF percentile** of the current accumulation within the country's historical precipitation distribution, mapped to an anomaly magnitude for the four-state thresholds, replacing the `log1p`-Gaussian z. The raw millimetre observations SHALL remain unchanged in storage and display. Where history is insufficient for a stable percentile, the facet SHALL fall back to the prior `log1p` path or remain stale, consistent with baseline warm-up.

#### Scenario: Precip anomaly from the empirical distribution
- **WHEN** `weather_precip` is scored for a country with sufficient history
- **THEN** its anomaly is the current accumulation's percentile in the country's own precip distribution, mapped to a z-band, not a `log1p`-Gaussian z

#### Scenario: Raw millimetres preserved
- **WHEN** the API or overlay reads `weather_precip`
- **THEN** it reads the raw millimetre accumulation (the percentile transform is not persisted)

### Requirement: Drought facet
The scoring engine SHALL score a **`weather_drought`** facet as a single-metric domain over `weather_precip`, computed as a **seasonal accumulation deficit** versus the country's climatological normal over a long window, configured `low`-sided so only a rainfall **shortfall** escalates (a wet period never opens a drought). It SHALL persist a `score` row with `domain='weather_drought'`, participate in per-facet hysteresis, and be excluded from the worst-of composite like the other weather facets. Flood detection via `weather_precip` (high tail) SHALL be unchanged.

#### Scenario: Persistent shortfall escalates drought
- **WHEN** a country's accumulated precipitation over the drought window is well below its climatological normal
- **THEN** its `weather_drought` facet escalates toward disrupted on the low (deficit) tail

#### Scenario: Wet period does not open drought
- **WHEN** a country's accumulation is at or above its normal
- **THEN** its `weather_drought` facet is operational, because the facet is one-sided (deficit only)

#### Scenario: Drought excluded from composite
- **WHEN** `weather_drought` is disrupted while markets/economy/relations are operational
- **THEN** the country's composite is unchanged, and the drought state is still persisted and served

