## 1. gdelt-worker: per-country aggregation

- [x] 1.1 In the existing export parse loop, additionally accumulate per-country tallies (Actor1 ∪ Actor2, ISO-3) of article-weighted `AvgTone`, article-weighted `GoldsteinScale`, and article/event volume — without disturbing the dyad tone accumulation.
- [x] 1.2 Emit `news_tone`, `news_goldstein`, `news_volume` point `Observation`s (`source='gdelt'`) via the point-observation upsert, gated by a per-country minimum article/event count.
- [x] 1.3 Add the per-country gate + any tunables to `common/config.py`; confirm the dyad `gdelt_tone` output is unchanged.

## 2. Scoring config + engine

- [x] 2.1 Add `DOMAIN_METRICS['news']` and `WEIGHTS['news']` (tone/goldstein/volume) plus per-metric τ and baseline settings for the new metrics in `common/config.py`.
- [x] 2.2 Score the `news` domain in the scoring-engine domain loop via the generic `score_domain` path, with hysteresis, and persist a `domain='news'` score row with a decomposable `inputs`.
- [x] 2.3 Ensure `composite_of()` ignores `news` (composite still = worst of markets/economy/relations); verify the news state is persisted but never changes a composite.

## 3. API

- [x] 3.1 Include the `news` domain state in `GET /api/countries/{iso3}` (domains payload) and expose its metric rows (news_tone/goldstein/volume) alongside the existing metrics.
- [x] 3.2 Confirm `/api/tiles` (composite choropleth) is unchanged.

## 4. Frontend: News health metric

- [x] 4.1 Add `'news'` to `HealthMetric` (`state/types.ts`) and the `news` field to `DomainStates` (`data/types.ts`); map it in `apiSource.ts` and synthesize it in `fixtures.ts`.
- [x] 4.2 Add the News entry + icon to the left rail (`LeftRail.tsx`, `icons.tsx`) and its label (`GlobeStage.tsx`); wire `news → 'news'` in the globe key map (`Globe.tsx`) so a selected country colors by its news state.
- [x] 4.3 Add the News chip + tone/Goldstein/volume rows to the country drill-down (`CountryDrilldown.tsx`), presented as informational/distinct from the composite domains, with stale styling for missing data.

## 5. Methodology + docs

- [x] 5.1 Document the News domain on the methodology page (`Methodology.tsx`): what tone/Goldstein/volume mean, the article-weighting, the coverage-not-ground-truth caveat, and that News is standalone (not in the composite).

## 6. Verification

- [x] 6.1 Confirm per-country `news_*` observations are written for a spread of countries (including ones thin on cross-border dyads), and that sparse windows are gated out.
- [x] 6.2 Confirm the `news` domain scores (not perpetually stale) after baseline warm-up and that its `inputs` decompose to the contributing metrics.
- [x] 6.3 Confirm selecting "News" recolors the selected country by its news state, and that the composite/tiles are unchanged even with News disrupted.
- [x] 6.4 Confirm the drill-down shows the News chip + rows with sources/sparklines, stale where data is missing.
