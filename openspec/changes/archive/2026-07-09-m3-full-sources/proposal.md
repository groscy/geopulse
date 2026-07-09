## Why

M1–M2 score countries from markets + GDELT tone only, which leaves the Economy domain thin and the Relations domain invisible on the map. Milestone M3 fills out the data foundation and the visual story: it adds the macro and FX sources that make the Economy domain real, draws bilateral relations as arcs on the globe, introduces the toggleable domain/overlay layer system in the left rail, and — critically — ships the **methodology page**, which the kickstart flags as a launch blocker (R-3), not a nice-to-have.

This change delivers M3 and completes FR-2 (domain layers), the Relations half of FR-3, and FR-6 (methodology page).

## What Changes

- Add the **macro-worker**: daily macro indicators from World Bank, IMF SDMX, OECD, FRED, and Eurostat (GDP growth, CPI, debt/GDP, etc.), normalized to `Observation` with appropriate confidence and slow-cadence τ.
- Add the **fx-worker**: FX-vs-USD rates via exchangerate.host on a ~15-minute cadence.
- Add the **relations arc layer**: great-circle, arched, occlusion-correct arcs between country pairs on the globe, colored by GDELT tone (hostile→tense→warm), with directional flow particles — using deck.gl ArcLayer or the equivalent canvas arc renderer from the design handoff (ADR-002).
- Add the **layer system** in the left rail: a single-select **Health metric** (Composite / Economy / Markets / Conflict) that drives selected-country coloring, and independent **Overlay toggles** (starting with Relations) that stack on the same globe, with the right-panel focus rule.
- Add the **methodology page**: full disclosure of the scoring formula, weights, baselines, and source cadences — z-score number-line diagram, worst-of composite examples, hysteresis explanation, and the staleness-is-a-state section.

## Capabilities

### New Capabilities
- `macro-ingestion`: the `macro-worker` and `fx-worker` — daily macro indicators across WB/IMF/OECD/FRED/Eurostat plus FX rates, normalized into the observation store, enriching the Economy and Markets domains.
- `relations-layer`: the on-globe bilateral relation arcs (tone-colored, arched, occluded) and directional flow particles.
- `domain-layers`: the left-rail single-select Health metric and independent stacking Overlay toggles, plus the right-panel focus rule that governs which panel shows.
- `methodology-page`: the long-form disclosure page documenting scoring, baselines, hysteresis, and staleness.

### Modified Capabilities
<!-- None as deltas: prior-milestone specs are not yet archived. M3 layers new sources onto data-ingestion/scoring and new views onto the frontend at implementation time. -->

## Impact

- **New workers** (Compose services): `macro-worker`, `fx-worker`, each with its own scheduler and provider token buckets.
- **scoring-engine**: Economy domain now has real inputs (CPI, GDP, debt/GDP, FX); domain weights/τ config extended for the new metrics.
- **api**: country endpoint returns the full six-metric set with real macro/FX data; a relations/arcs endpoint (or dyad data on the country + a global arcs endpoint) feeds the arc layer.
- **frontend**: globe gains the arc layer + flow particles; left rail gains the Health single-select and Overlay toggles; new methodology route.
- **External APIs**: World Bank, IMF SDMX, OECD, FRED (key required), Eurostat, exchangerate.host.
- **Out of scope**: conflict-worker (ACLED/UCDP) and the Conflict overlay data path (leaning v2 per Q-2 — the Conflict Health option may render but without a live source); rate-limit chaos testing, retention, and deploy profiles (M4).

## Depends On
- m2-drilldown-incidents
