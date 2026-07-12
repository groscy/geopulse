## ADDED Requirements

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
