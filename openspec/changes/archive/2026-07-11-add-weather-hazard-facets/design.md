## Context

Phase 1 (`add-weather-domain`) scored one metric, `weather_temp`, as a `weather` domain and made the Meteorological overlay a real temperature choropleth; Phase 1.5 (`add-weather-temp-labels`) added size-LOD numeric labels. Phase 1's design.md captured **Phase 2 — point-scalar suite**: emit precipitation, wind, and cloud from the same Open-Meteo call and broaden `DOMAIN_METRICS['weather']`/`WEIGHTS['weather']`, "panel shows the suite."

This change **refines** that Phase-2 bullet in four ways, decided in exploration:

1. **Faceted, not blended** — each hazard is its own scored signal, not one averaged `weather` z.
2. **Cloud deferred to Phase 3** — it is a visual field quantity, not a point hazard.
3. **Switchable choropleth**, not a panel-only suite — the map can show each hazard.
4. **Precip transform now** — a `log1p` anomaly, flood-only.

GeoPulse's spine is per-country scalars → self-relative z → four-state domains → hysteresis → worst-of composite → incidents, all config-driven. The `news`/`weather` domains are the precedent for standalone scored domains excluded from the composite; `metric` and `domain` are free-text, so new signals are additive (no migration).

## Goals / Non-Goals

**Goals**
- Add precipitation and wind as real, scored hazard signals from the existing keyless call — no new source, no cloud.
- Keep each hazard's semantics honest: independent hazards don't average; wind is one-sided; precip is skewed.
- Reuse the scoring/hysteresis/incident/composite-exclusion machinery with the **least new code** — ideally only config plus two small per-metric hooks.
- Let the overlay *show* each hazard (switchable choropleth), not just list numbers.
- Leave the composite, the Health single-select, and `news` untouched.

**Non-Goals (v1)**
- No cloud cover and no 3D atmospheric field shell — Phase 3.
- No live storm tracks — Phase 4; spirals stay decorative.
- No **drought** (dry-tail) precip signal — needs a seasonal-deficit baseline, not a 90-day daily self-baseline.
- No z-scored **anomaly choropleth mode** — a natural fast-follow, deferred; v1 ships absolute modes.
- No day-of-year climatology baseline; no composite participation.

## Decisions

- **Facet = pseudo-domain (the core mechanism).** Register each hazard as a **single-metric domain**: `DOMAIN_METRICS = { …, 'weather_temp':['weather_temp'], 'weather_precip':['weather_precip'], 'weather_wind':['weather_wind'] }`, each with `WEIGHTS[d] = {metric: 1.0}`. Consequences, all of which reuse existing code:
  - `score_domain` runs **unchanged** — a single-metric weighted mean *is* that metric's z, so **there is nothing to blend** (kills the "averaging independent hazards" problem structurally, not by policy).
  - `apply_hysteresis` is keyed `(country, domain)` → **per-facet debounce for free** (a flood's counter is independent of a heatwave's), no new `domain_state` schema.
  - `incident_lifecycle` is keyed `country:domain` → **per-facet incidents for free** (`country:weather_precip` etc.), no new incident loop.
  - `composite_of` filters to `COMPOSITE_DOMAINS`; the facet domains are absent → **excluded from the composite for free**, like `weather` was.
  - Phase 1's `weather` domain was already `[weather_temp]`, so this is a **rename + two siblings**, not a rework. Old `domain='weather'` score/state rows become orphaned and harmless (additive, free-text — no migration).
  - Rationale: this is the same "free-text domain is additive" lever Phase 1 pulled for `news` and `weather`. It converts a genuinely-new scoring feature into config plus a couple of lookups.

- **Directionality (`SIDED`) lives in the four-state mapping, not the incident code.** New config `SIDED = {'weather_temp':'both', 'weather_precip':'high', 'weather_wind':'high'}`. In the state derivation, a `'high'` metric uses **signed** z (only the positive tail escalates; the negative tail clamps to operational); `'both'` uses `abs(z)` as today. Because directionality is baked into the *state*, `incident_lifecycle` still gates on `state` **unchanged**: a dead-calm day (`weather_wind` z=−2) is `operational` and opens nothing; a gale (z=+2) is `disrupted` and opens a wind event; temperature escalates on either tail. Rationale: one place, no incident-code churn, and the overlay's per-facet state is automatically hazard-correct.

- **Precip anomaly on `log1p(mm)`, applied only in the z path.** New per-metric transform config (e.g. `METRIC_TRANSFORM = {'weather_precip': log1p}`) applied to the baseline series **before** mean/std in `_series_z`. The **raw mm is what's stored and displayed** (the choropleth shows real accumulation); the transform is purely to make the anomaly statistic sane against a right-skewed, zero-inflated distribution. Precip is `'high'`-sided (flood only). Rationale: `log1p` is the pragmatic v1 (monotonic, sign-preserving, handles the skew); a percentile / empirical-CDF anomaly is more correct but more code — deferred. Drought is deferred because the low tail on log-precip over a 90-day daily window is a wall of zeros with no resolution.

- **Aggregation is per-facet for display.** The absolute value each mode shows differs by hazard: temperature = 7-day **mean** °C (unchanged), precipitation = 7-day **total** mm (accumulation, not a mean), wind = 7-day **max** km/h (the gust that matters, not a mean). `/api/weather` computes all three server-side. Rationale: "weekly mean" was right for temperature and wrong for the others; each hazard's natural summary differs.

- **Switchable choropleth = facet selector.** The overlay gains a **Temp | Precip | Wind** mode (default Temp). The mode *is* the facet: each mode colors land by that facet's absolute aggregate and reflects that facet's anomaly/incidents. Temp uses the existing **diverging** blue↔red six-stop scale; precip and wind use **sequential** scales (0→high) with their own stops, legends, and units. The Phase-1.5 label pass is metric-agnostic (LOD by on-screen size), so it generalizes by swapping value+unit per mode. Rationale: it aligns the two features on one axis and makes the ingested precip/wind actually visible.

- **Fallback asymmetry is honest.** Temperature keeps its **latitude fallback** so the overlay is never blank in the fixtures/demo path. Precip and wind have **no synthetic analog** — in the no-live-data path their modes render no choropleth and no labels (empty state), rather than fabricating a value. Rationale: never present a made-up hazard as real (same principle as "no label on the temp fallback").

- **Per-facet incident titles.** `_incident_title` generalizes from one `weather` special-case to a per-facet map: `weather_temp` → "{name} · heat/cold anomaly" (by sign of z); `weather_precip` → "{name} · flood risk"; `weather_wind` → "{name} · wind event". Each carries the `disrupted` floor (|z| ≥ 2) from Phase 1, per facet (uniform in v1, individually tunable later).

- **No DB migration.** Two new free-text metrics (`weather_precip`, `weather_wind`) and three free-text domains — additive, exactly as `news` and Phase-1 `weather`.

## Risks / Trade-offs

- **Zero-inflated precip even after `log1p`.** A country that is usually dry still has a spike of zeros; `log1p` tames the skew but a genuinely rare rain event can still read as a large z. → Accepted for v1: flood-only + `disrupted` floor + hysteresis (N=3) damp it; percentile anomaly is the deferred clean fix. Documented on the methodology page.
- **7-day max wind at a single capital point** misses gusts elsewhere in a large country and is noisy hour-to-hour. → Accepted: the signal is a self-relative anomaly at a fixed point (same v1 simplification as temp); the field shell (Phase 3) is the spatial answer. Hysteresis smooths the hour-to-hour noise.
- **More open incidents.** Three facets instead of one can raise the open-incident count (a continental heat dome + a monsoon could co-fire). → `disrupted`-only floor per facet + hysteresis; watch the open-incident count after the new baselines warm up, same as Phase 1.
- **Baseline warm-up for the two new metrics.** `weather_precip`/`weather_wind` need ~`MIN_BASELINE_POINTS` daily buckets before leaving `stale`. → Consistent with every metric; the absolute choropleth value renders immediately (needs no baseline), anomaly/incidents warm up over days.
- **Mode selector is a new overlay sub-pattern.** Overlays are single-select in the left rail; a sub-mode *within* an overlay is new UI. → Contained to the Meteorological panel; default Temp preserves current behavior; other overlays unaffected.
- **Orphaned `domain='weather'` rows.** Historical Phase-1 rows linger unread. → Harmless (additive store); the api/overlay read facet domains; can be pruned by data-retention later if desired.

## Migration Plan

Additive, reversible. (1) weather-worker adds two `current=` fields and emits `weather_precip`/`weather_wind`. (2) config: three facet domains, τ/`HIGH_FREQ` for the new metrics, `SIDED`, the precip transform, per-facet incident floors. (3) scoring-engine: apply `SIDED` in the four-state mapping and the transform in the z path; add the facets to the domain loop and `INCIDENT_DOMAINS`; generalize `_incident_title`; keep all three out of `COMPOSITE_DOMAINS`. (4) `/api/weather` returns three aggregates + per-facet state. (5) frontend: mode selector + mode-aware choropleth/labels. (6) methodology page: document precip's `log1p` flood-only anomaly, wind's one-sided max, and the per-facet incidents. **Rollback**: stop emitting the two metrics and drop the two facet domains from the loop; the overlay falls back to Temp-only; the composite/`news`/other domains are unaffected because the facets never fed them.

## Roadmap (updated from Phase 1)

- **Phase 3 — 3D atmospheric field shell.** A `weather-field-worker` fetches a coarse global grid of `{cloud%, windU, windV, precip}` on a slow cadence, cached as one blob, served by `GET /api/weather-field`, rendered as lifted shells/particles around the globe. **Cloud cover moves here** (deferred from Phase 2). Field data has no country and no z-score — it does not flow through the observation store or scoring.
- **Phase 4 — live storm tracks.** A `storm-worker` (NHC/JTWC) replaces the decorative spirals with real cyclone positions/tracks, opening `country:storm` incidents via the same `INCIDENT_DOMAINS` seam.
- **Fast-follows / later** — a z-scored **anomaly choropleth mode** (nearly free given per-facet state is already in `/api/weather`); a **drought** signal on a seasonal-deficit baseline; a **percentile** precip anomaly replacing `log1p`; day-of-year climatology baseline; optional composite participation; a weather chip in the country drill-down.

## Open Questions (resolved in exploration)

- **Blend or facet?** → **Facet**, via the pseudo-domain mechanism.
- **Cloud in Phase 2?** → **No** — deferred to Phase 3's field shell.
- **Display ambition?** → **Switchable choropleth** (temp/precip/wind), not panel-only.
- **Precip honesty?** → **Transform now** (`log1p`), **flood-only** (high tail).
- **Wind directionality?** → **One-sided** (high tail); `SIDED` config, applied in state derivation.
