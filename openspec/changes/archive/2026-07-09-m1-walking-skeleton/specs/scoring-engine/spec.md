## ADDED Requirements

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
