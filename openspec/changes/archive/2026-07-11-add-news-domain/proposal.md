## Why

GeoPulse already ingests GDELT: every 15 minutes the `gdelt-worker` downloads and parses the **full** GDELT 2.0 event export — but it keeps only one field, `AvgTone`, and only for **cross-border** pairs (`Actor1 ≠ Actor2`, both ISO-3, ≥ `GDELT_MIN_EVENTS`). That single dyad tone feeds the Relations domain (the "Conflict" health metric). Two consequences:

- **Most countries get no per-country reading.** A country only surfaces if it appears in enough *bilateral* coded events. Domestic unrest, single-actor events, and thin-dyad countries produce nothing.
- **Rich, already-parsed fields are discarded.** The same in-hand row carries `GoldsteinScale` (−10..+10 conflict/cooperation intensity), `QuadClass`, and article/mention volume — all thrown away every cycle.

This change mines what GDELT already fetched to give **every tracked country a news-climate evaluation**, as a new **News** domain. It needs no new upstream, no API key, and **no LLM** — GDELT's CAMEO/tone/Goldstein coding *is* the news-evaluation layer an LLM would otherwise reproduce.

This is a post-M4 enhancement. It extends FR-2 (domain layers) with a fourth scored domain and reuses the M1 scoring/staleness machinery and the M2 hysteresis unchanged.

## What Changes

- **gdelt-worker** — in the *same* fetch/parse loop, additionally aggregate events **per country** (where the country is `Actor1` or `Actor2`), article-weighted, and emit point `Observation` rows: `news_tone`, `news_goldstein`, `news_volume`. A per-country minimum-article gate suppresses noise. **The existing dyad-tone path is unchanged.**
- **scoring-engine** — add a `news` domain scored through the existing generic weighted-rollup path (`score_domain`), with per-metric weights, staleness τ, four-state mapping, and hysteresis exactly like the other point-based domains. **The news domain is EXCLUDED from the worst-of composite** — it is persisted, colored, and selectable, but never moves a country's composite state (avoids double-counting GDELT, which already drives Relations, and keeps the headline composite on economic/market signals).
- **frontend** — add **News** as the 5th single-select Health metric in the left rail (icon + label), coloring the selected country exactly like Economy/Markets; add a News chip + metric rows to the country drill-down; document it on the methodology page.
- **No database migration** — `observation.metric` and `score.domain` are free-text; the new metrics and `domain='news'` rows are additive data.

## Capabilities

### New Capabilities
- None. This change layers a new scored domain onto existing capabilities.

### Modified Capabilities
- `data-ingestion`: the `gdelt-worker` additionally emits per-country point signals (`news_tone`, `news_goldstein`, `news_volume`) alongside its existing dyad tone.
- `scoring-engine`: a new `news` domain is scored via the standard rollup but excluded from the worst-of composite.
- `domain-layers`: the single-select Health metric group gains a fifth option, **News**.
- `country-drilldown`: the drill-down shows a News domain chip and its metric rows.

## Impact

- **Backend**: `services/gdelt-worker/main.py` (per-country aggregation + point emission), `services/common/config.py` (`WEIGHTS['news']`, `DOMAIN_METRICS['news']`, τ + baseline for the new metrics, per-country article gate), `services/scoring-engine/main.py` (score `news`; exclude it from `composite_of`).
- **api**: `services/api/main.py` includes the `news` domain state (and its metric rows) in the country payload.
- **frontend**: `state/types.ts` (`HealthMetric` += `'news'`), `layout/LeftRail.tsx` + `layout/icons.tsx` (rail entry + icon), `layout/GlobeStage.tsx` (label), `globe/Globe.tsx` (`news → 'news'` key map), `data/types.ts` (`DomainStates.news`), `data/apiSource.ts` + `data/fixtures.ts` (map/synthesize), `panels/CountryDrilldown.tsx` (chip + rows), `views/Methodology.tsx` (document the domain).
- **Database**: no migration (free-text `metric`/`domain`).
- **External APIs**: none added — same GDELT export, same cadence, no key.
- **Out of scope**: LLM/editorial summarization of headlines (explicitly dropped — GDELT coding is the evaluation); news-driven **incidents** in the global feed (v1 does not emit them, to avoid flooding — can be enabled later); feeding the News domain into the composite (deferred; standalone for v1); ActionGeo/FIPS-based geolocation of events (uses actor country codes only); new upstream news sources (Keystone-SDA / newswire — considered and rejected on AI-use licensing + Swiss-centric coverage).

## Depends On
- None active. Builds on the archived M1–M4 specs (`data-ingestion`, `scoring-engine`, `domain-layers`, `country-drilldown`), already merged into `openspec/specs/`.
