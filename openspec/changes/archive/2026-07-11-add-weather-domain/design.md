## Context

The Meteorological overlay exists but is decorative: `tempColor(lat, seed) = 31 − |lat|·0.72 + noise` tints land by latitude, and `STORMS` is five hardcoded spirals. There is a `weather` **overlay** (`OverlayId`) but no `weather` **scoring domain**. GeoPulse's spine is per-country scalars → self-relative z-scores → four-state domains → worst-of composite → incidents, all config-driven; the `news` domain (archived `add-news-domain`) is the precedent for a standalone scored domain that is excluded from the composite.

The user's intent, decided in exploration: weather is **analytical** ("a geopolitical risk signal"), the anomaly baseline can be **cheap** for v1, the scored signal is **folded into the existing Meteorological overlay** (not a new Health metric), and we **start with Phase 1 but capture the future phases** to build on.

## Goals / Non-Goals

**Goals**
- Show each country's **average weekly temperature** on the globe from real data (the literal ask), replacing the latitude fake.
- Score temperature as a per-country **anomaly** through the existing stack — no new scoring math — so heat/cold events surface as incidents.
- Keep it keyless and fault-isolated, consistent with the other workers.
- Fold into the existing overlay; leave the Health single-select, the composite, and `news` untouched.
- Lay down the seams so Phases 2–4 slot in without rework.

**Non-Goals (v1)**
- No 3D atmospheric field shell (clouds/wind/rain) — Phase 3.
- No live storm tracks — Phase 4; spirals stay decorative.
- No day-of-year climatology baseline — cheap 90-day self-baseline for v1.
- No composite participation; no new Health rail metric; no drill-down chip.

## Decisions

- **Fold into the Meteorological overlay, not a new Health metric.** `news` added a 5th single-select Health metric; `weather` does **not**. The scored `weather` domain instead *backs the existing overlay*: the overlay's temperature choropleth becomes real, and the anomaly state drives incidents + (optionally) an overlay flag. Rationale: the user asked to fold into the existing meteorological overlay; it avoids growing the Health group and keeps weather visually where users already expect it.

- **Two derived views from one metric.** From `weather_temp` we surface (a) the **absolute 7-day mean** (°C) → the choropleth color (the literal ask), and (b) the **self-relative z** → the anomaly state → incidents. The choropleth answers "how warm is it there," the anomaly answers "is this unusual for there." Both come from the same observations; no second source.

- **Cheap 90-day self-relative baseline (accepted drift).** `weather_temp` reuses the default `BASELINE_DAYS=90` and the `HIGH_FREQ`/`observation_daily` path, so the z-score is "vs this country's own last-~season average." This captures spikes and makes Dubai-in-summer read as normal-for-Dubai, but it has **seasonal drift** (a 90-day window spanning spring warming biases the mean), so it is not a true "vs seasonal normal." Accepted for v1; the clean fix (day-of-year climatology, e.g. Open-Meteo normals) is deferred. Documented on the methodology page.

- **Standalone domain, excluded from the composite (mirror `news`).** `COMPOSITE_DOMAINS` stays `{markets, economy, relations}`. `weather` is scored, hysteresis-committed, and persisted (`domain='weather'`), but never a composite vote. Rationale: a heatwave is an adjacent stressor, not itself geopolitical-risk state; trivially promotable later.

- **Decouple incident-eligibility from composite-membership.** Today `incident_lifecycle` skips any domain `not in COMPOSITE_DOMAINS`, which is exactly what keeps `news` incident-free. To let `weather` open incidents *without* joining the composite, introduce a separate `INCIDENT_DOMAINS = COMPOSITE_DOMAINS ∪ {"weather"}` and gate the lifecycle on that. `news` stays out of `INCIDENT_DOMAINS` → unchanged. Rationale: incidents are the analytical payoff ("Heat anomaly · Iberia") and reuse the existing schema/dedup/resolution with no new incident code.

- **Weather incidents open at `disrupted` only (v1).** The generic lifecycle opens at `degraded` (|z| ≥ 1) or `disrupted` (|z| ≥ 2). Weather at |z| 1–2 vs a drifting 90-day baseline is common and noisy, so v1 gates weather incidents to `disrupted` (|z| ≥ 2) via a config floor. Rationale: only a genuine extreme deserves a feed slot; keeps the feed honest. Easy knob to lower later.

- **`/api/weather` as a parallel overlay endpoint.** Weather is an overlay, so it gets its own tiles-like endpoint (`GET /api/weather`) the globe fetches on an interval — exactly like `/api/arcs` for the Relations overlay — rather than bloating `/api/tiles` (the composite choropleth) or the country payload. The endpoint returns `[{country, tempC, state, ageMin}]` where `tempC` is the 7-day mean from `observation_daily`.

- **Weekly average = 7-day mean of daily buckets.** `weather_temp` joins `HIGH_FREQ`, so it flows through the `observation_daily` continuous aggregate. "Average weekly temperature" is the mean of the last 7 daily buckets per country — no new aggregation, just a query in `/api/weather`.

- **Representative point per country.** The worker samples one lat/lon per country (centroid or capital) held in `config.WEATHER_POINTS`. One point per country is a deliberate simplification (large/climate-diverse countries get a single reading); acceptable because the signal is a *self-relative anomaly at a fixed point*, and Phase 3's field shell is where spatial nuance lives.

- **No DB migration.** `observation.metric` and `score.domain` are free-text; `weather_temp` and `domain='weather'` are additive, exactly as `news` was.

## Risks / Trade-offs

- **Seasonal-drift baseline** (above) — a 90-day self-baseline is not a seasonal normal. → Accepted for v1, documented, `disrupted`-only incident floor limits false alarms; climatology baseline deferred.
- **Single point per country** misrepresents large/varied countries. → Accepted; anomaly is point-relative; field shell (Phase 3) is the spatial answer.
- **Feed flooding** if many countries anomalize together (e.g. a continental heat dome). → `disrupted`-only floor + hysteresis (N=3) damp it; watch open-incident count after first baselines warm up.
- **Open-Meteo dependency / quota.** → Keyless, generous free tier; token-bucket + graceful skip like every worker; on outage, temps go stale (not crash), and the overlay falls back to the latitude tint.
- **Bootstrap latency** — `weather_temp` needs ~`MIN_BASELINE_POINTS` (~20) daily points before leaving `stale`. → Consistent with all metrics; overlay shows real temp immediately (absolute value needs no baseline), anomaly/incidents warm up over days.
- **Overlay demo path** — fixtures have no live weather. → `tempColor` keeps the latitude fallback when `/api/weather` is empty or `VITE_API_BASE` is unset, so the fixtures demo still renders.

## Migration Plan

Additive, reversible. (1) Add `weather-worker` emitting `weather_temp`; register it in supervisord/compose. (2) Add `weather` scoring config (`DOMAIN_METRICS`/`WEIGHTS`/τ/`HIGH_FREQ`/incident floor). (3) Score `weather` in the domain loop, persist it, keep it out of `COMPOSITE_DOMAINS`; add `INCIDENT_DOMAINS` and gate `incident_lifecycle` on it. (4) Add `GET /api/weather`. (5) Point `tempColor` at the fetched weather map with latitude fallback; show real values in the panel; document on methodology. **Rollback**: stop the worker and hide/period-out `/api/weather` — the overlay falls back to the latitude tint, and the composite/`news`/incidents for other domains are unaffected because `weather` never fed them.

## Roadmap (captured now, built on afterwards)

The worker/scoring/endpoint seams above are chosen so these slot in without rework:

- **Phase 2 — point-scalar suite.** The *same* `weather-worker` call already returns precipitation, wind, and cloud cover. Emit `weather_precip`, `weather_wind`, `weather_cloud` and broaden `DOMAIN_METRICS['weather']`/`WEIGHTS['weather']` (the `gdelt-worker` one-source-many-metrics pattern). Panel shows the suite. No new source.
- **Phase 3 — 3D atmospheric field shell (the "3D overlay around the globe").** A new `weather-field-worker` fetches a coarse global grid (GFS via NOAA, or coarse Open-Meteo) of `{cloud%, windU, windV, precip}` on a slow cadence — **not real-time**, cached as one compact blob (~2.5° grid ≈ 10k cells) served by `GET /api/weather-field`. The globe renders it as **lifted shells/particles around the sphere**, reusing the existing satellite-shell occlusion (`ORBITS`, `lift()`, `shown()`) and arc flow-particle code: clouds as a translucent layer at alt≈1.03, wind as advected particles at alt≈1.02, rain as stipple at alt≈1.01. This is the field/visual half; it does **not** flow through the observation store or scoring (fields have no country and no z-score).
- **Phase 4 — live storm tracks.** A `storm-worker` (NHC/JTWC advisories) replaces the five hardcoded `STORMS` with real cyclone positions/category/track (feature data), rendered by the existing spiral glyphs and opening `country:storm` incidents via the `INCIDENT_DOMAINS` seam added here.
- **Later** — day-of-year climatology baseline (replace cheap 90-day self-baseline); optional `weather` composite participation; a weather chip + rows in the country drill-down.

## Open Questions

- **Worker cadence** — `WEATHER_INTERVAL` default? Lean hourly (3600s); weekly mean smooths it and Open-Meteo current-conditions update roughly hourly.
- **Representative point** — capital vs geometric centroid? Lean capital (population-weighted proxy) where known, centroid fallback.
- **Country set** — reuse the `MACRO_COUNTRIES` set, or all countries with a centroid? Lean start with the tracked set, widen once stable.
- **Anomaly on the overlay** — beyond incidents, should the overlay visually flag `disrupted` countries (outline/marker), or is the temperature tint + feed enough for v1? Lean: tint + feed for v1, marker is cheap to add.
- **Incident title/units** — "{Country} · weather disrupted" (generic lifecycle) vs a weather-specific "Heat/Cold anomaly · {Country}" using the sign of z. Lean weather-specific for legibility.
