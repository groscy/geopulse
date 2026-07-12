## Why

Phase 1 (`add-weather-domain`) made the Meteorological overlay data-backed and scored one metric — surface **temperature** — as a self-relative anomaly. Its design.md captured a **Phase 2** ("point-scalar suite"): the *same* Open-Meteo call already returns precipitation, wind, and cloud cover, so emit them and broaden the `weather` domain.

Taken literally, that Phase-2 bullet has three latent problems, because the roadmap assumed the new scalars behave like temperature. They don't:

1. **Blending hides hazards.** The domain rollup (`score_domain`) is a *weighted mean* of per-metric z. That is correct for `markets`/`economy`, whose metrics are correlated facets of one latent state. Weather's metrics are **independent hazards** — a flood (precip z=3) averaged with normal temp/wind washes out to a muddy ~1.0 and never crosses the `disrupted` incident floor. Averaging independent stressors suppresses exactly the extremes we want.
2. **The incident title breaks.** `_incident_title` hardcodes `kind = "heat" if z>0 else "cold"` for the whole `weather` domain. The moment `weather` has more than one metric, a windstorm gets titled "heat anomaly."
3. **Directionality and distribution differ.** Wind is a **one-sided** hazard (only the high tail matters — a dead-calm day must not open a "wind event"). Precipitation is **zero-inflated and heavily right-skewed**, so a Gaussian z on raw mm is meaningless (a dry country's one rainy hour reads as z=6). Cloud cover is not a point hazard at all — it is a visual *field* quantity that belongs to Phase 3.

This change delivers Phase 2 **faithfully** rather than literally: weather becomes a small **faceted hazard layer** — temperature, precipitation, and wind, each scored, thresholded, and surfaced on its own terms — and the overlay gains a **switchable choropleth** so the map can show each hazard.

## What Changes

- **Faceted via the pseudo-domain trick.** Each hazard is registered as its own **single-metric domain** — `weather_temp`, `weather_precip`, `weather_wind` — instead of one multi-metric `weather` domain. Because each domain has exactly one metric, `score_domain`'s weighted mean degenerates to that metric's z (no blending — problem 1 is structurally impossible), and `apply_hysteresis` (keyed by `(country, domain)`) and `incident_lifecycle` (keyed `country:domain`) give **per-facet hysteresis and per-facet incidents for free**, with no new hysteresis schema and no new incident loop. Phase 1's `weather` domain (already `[weather_temp]`) simply **becomes** the `weather_temp` facet.
- **weather-worker (no new source)** — the existing single batched Open-Meteo call adds `precipitation` and `wind_speed_10m` to its `current=` params and emits `weather_precip` and `weather_wind` point observations alongside `weather_temp`. **Cloud cover is deferred to Phase 3** (the field shell), so it is not fetched or stored here. Same keyless, token-bucketed, graceful-skip behavior.
- **Directionality (`SIDED`), in state derivation.** A new per-metric config `SIDED = {weather_temp: 'both', weather_precip: 'high', weather_wind: 'high'}` makes a one-sided metric reach `degraded`/`disrupted` **only on its hazard tail**; the non-hazard tail clamps to `operational`. This lives in the four-state mapping, so `incident_lifecycle` still gates on `state` unchanged — a becalmed day never opens a wind incident, a gale does.
- **Precipitation transform (`log1p`), flood-only.** A new per-metric transform applied **only in the z path** (raw mm stays stored for display) computes the precip anomaly on `log1p(mm)` to tame the right-skew. Precip is `'high'`-sided (flood only): drought detection needs a long-window seasonal deficit baseline, not a 90-day daily self-baseline over a wall of zeros, so it is out of scope for v1.
- **Per-facet incidents.** `INCIDENT_DOMAINS` gains the three facet domains; `_incident_title` generalizes from one `weather` special-case to a per-facet map: **heat/cold anomaly** (temp, by sign), **flood risk** (precip), **wind event** (wind). All reuse the existing incident schema, dedup, and resolution unchanged. The `disrupted` floor (|z| ≥ 2) carries over per facet.
- **Switchable choropleth (frontend).** The Meteorological overlay gains a **Temp | Precip | Wind** mode selector (default Temp). Each mode colors land by that facet's absolute 7-day aggregate with its own scale, legend, and units — temperature by 7-day **mean** °C (diverging, unchanged), precipitation by 7-day **total** mm (sequential), wind by 7-day **max** km/h (sequential). The Phase-1.5 numeric labels generalize to follow the active mode (`23°` / `48mm` / `62 km/h`). Temp keeps its latitude fallback; precip/wind render only with live data (no synthetic analog exists).
- **api** — `GET /api/weather` returns all three aggregates plus per-facet committed state in one payload (`{country, tempC, precipMm, windMax, states:{temp,precip,wind}, ageMin}`) so the globe switches modes client-side with no refetch. It reads the three facet domains instead of `domain='weather'`.
- **No database migration** — `observation.metric` and `score.domain` are free-text; the two new metrics and three facet domains are additive data, exactly as `news` and Phase-1 `weather` were.

## Capabilities

### New Capabilities
- None. This change refines an existing scored domain into facets and extends an existing overlay.

### Modified Capabilities
- `data-ingestion`: the `weather-worker` additionally emits `weather_precip` and `weather_wind` point observations from the same Open-Meteo call (cloud deferred to Phase 3).
- `scoring-engine`: weather is scored as three single-metric facet domains (`weather_temp`/`weather_precip`/`weather_wind`); adds per-metric **directionality** (one-sided hazards) and a per-metric **anomaly transform** (`log1p` for precip); all three facets stay excluded from the worst-of composite.
- `incident-detection`: weather incidents become **per-facet** — heat/cold anomaly, flood risk, wind event — via the new facet domains, replacing the single `country:weather` incident.
- `meteorological-overlay`: the choropleth becomes **mode-switchable** (temperature/precipitation/wind), each with its own scale, legend, units, and value labels.
- `api-service`: `GET /api/weather` returns per-country temperature, precipitation, and wind aggregates plus per-facet anomaly state.

## Impact

- **Backend**: `services/weather-worker/main.py` (add `precipitation`, `wind_speed_10m` to `current=`; emit two more metrics). `services/common/config.py` (three facet entries in `DOMAIN_METRICS`/`WEIGHTS`; `TAU_SECONDS` and `HIGH_FREQ` for the two new metrics; new `SIDED` and per-metric transform config; facet incident floors). `services/scoring-engine/main.py` (apply `SIDED` in the four-state mapping; apply the precip transform in the z path; add the three facets to the domain loop and `INCIDENT_DOMAINS`; generalize `_incident_title`; keep all three out of `COMPOSITE_DOMAINS`).
- **api**: `services/api/main.py` (`/api/weather` returns three aggregates + per-facet state; reads facet domains).
- **frontend**: `globe/Globe.tsx` (mode-aware choropleth + value labels for three scales), `panels/OverlayPanel.tsx` (mode selector + per-mode legend/suite), `data/apiSource.ts` / types (extended weather payload). No change to the Health single-select or the composite choropleth.
- **Deployment**: none — the existing `weather-worker` process is unchanged in registration; only its emitted metrics grow.
- **Database**: no migration (free-text `metric`/`domain`). Old `domain='weather'` score/state rows become orphaned and harmless; the overlay/api read the facet domains.
- **External APIs**: none new — same keyless Open-Meteo call, two more `current=` fields.
- **Out of scope (later phases — see design Roadmap)**: cloud cover and the **3D atmospheric field shell** (Phase 3); **live storm tracks** (Phase 4); a **drought** (dry-tail) precip signal on a proper seasonal-deficit baseline; a z-scored **anomaly choropleth mode** (a natural fast-follow, deferred); day-of-year climatology baseline; weather participation in the composite.

## Depends On
- None active. Builds on the archived `add-weather-domain` (the `weather` domain, `/api/weather`, data-backed overlay) and `add-weather-temp-labels` (the numeric-label LOD pass), both already merged into `openspec/specs/`.
