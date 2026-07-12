## ADDED Requirements

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
