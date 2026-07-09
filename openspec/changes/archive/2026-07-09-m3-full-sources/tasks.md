## 1. Macro worker

- [x] 1.1 Add `macro-worker` Compose service on the shared worker base with a daily scheduler.
- [x] 1.2 Implement provider clients: World Bank, Eurostat, FRED (key), then OECD / IMF SDMX as enrichment.
- [x] 1.3 Map provider series to canonical metrics (CPI, GDP growth, debt/GDP, …) with per-source confidence; assign slow-cadence τ.
- [x] 1.4 Write observations; verify coverage for a spread of countries and that duplicates across providers land under one canonical metric.

## 2. FX worker

- [x] 2.1 Add `fx-worker` Compose service with a ~15-min scheduler.
- [x] 2.2 Implement exchangerate.host client; write `fx_usd` observations per currency/country.
- [x] 2.3 Honor the shared token bucket and graceful-skip behavior.

## 3. Scoring config for new metrics

- [x] 3.1 Extend domain weights/τ config so the Economy domain uses CPI/GDP/debt and Markets uses FX where relevant.
- [x] 3.2 Re-verify worst-of composite and staleness behavior with the richer Economy inputs.

## 4. API: relations & fuller country data

- [x] 4.1 Add a relations/arcs endpoint (global tone-scored pairs) and ensure `dyad_observation` tone is queryable per pair.
- [x] 4.2 Confirm `GET /api/countries/{iso3}` now returns real macro/FX metric series for the six key metrics.

## 5. Frontend: relations arc layer

- [x] 5.1 Implement great-circle arched arcs (radial lift `1 + h·sin(π·f)`, `h = min(0.34, geoDistance·0.17)`) colored by tone scale.
- [x] 5.2 Implement the exact occlusion test (far-hemisphere AND inside silhouette R); verify limb behavior against `GeoPulse.dc.html`.
- [x] 5.3 Implement directional flow particles with `sin(π·phase)` fade, respecting `reduceMotion`.
- [x] 5.4 Scope arcs: all pairs when Relations overlay on; only selected country's arcs when off + selected. Cap to top-|tone| if needed for 60 fps.

## 6. Frontend: layer system

- [x] 6.1 Add the Health metric single-select group (Composite/Economy/Markets/Conflict) driving selected-country coloring.
- [x] 6.2 Add independent Overlay toggles (Relations) that stack; show active state on rail buttons.
- [x] 6.3 Implement the right-panel focus rule (most-recently-toggled overlay panel; fall back to feed).
- [x] 6.4 Add the top-left active-layer summary chip and per-layer legend sections (state key + tone gradient).

## 7. Methodology page

- [x] 7.1 Add the methodology route: scrollable max-width column, opened from the rail book icon, back-to-dashboard control.
- [x] 7.2 Build the z-score number-line diagram (green/amber/red bands, symmetric, sample marker), driven by real band config.
- [x] 7.3 Build the worst-of composite worked examples (Japan→Degraded, Argentina→Disrupted) marking the worst domain.
- [x] 7.4 Build the hysteresis section (enter 1.0 / recover 0.7 / N-hold) and the staleness-is-a-state section (grey-hatch + Eritrea 94d), driven by config.
- [x] 7.5 Add the sources/cadences footnote.

## 8. Verification

- [x] 8.1 Confirm Economy domain scores from real macro/FX data (not stale) for covered countries.
- [x] 8.2 Confirm relations arcs render tone-colored, arched, and correctly occluded; flow particles animate and stop under reduceMotion.
- [x] 8.3 Confirm Health single-select recolors a selected country by domain; Relations toggle stacks; focus rule switches the panel.
- [x] 8.4 Confirm the methodology page opens, and its bands/N/τ match the engine config (no drift).
