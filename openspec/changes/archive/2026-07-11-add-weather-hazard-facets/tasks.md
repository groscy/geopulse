## 1. weather-worker: precipitation + wind

- [x] 1.1 Add `precipitation` and `wind_speed_10m` to the single batched Open-Meteo `current=` request in `services/weather-worker/main.py` (no new call, no cloud).
- [x] 1.2 Emit `metric='weather_precip'` (mm) and `metric='weather_wind'` (km/h) point `Observation` rows alongside `weather_temp`, ISO-3 `country`, `source='open-meteo'`, tolerating a missing individual field per country (emit what's present, skip the missing metric).
- [x] 1.3 Confirm the graceful-skip / token-bucket / keyless behavior is unchanged and now covers all three metrics.

## 2. Scoring config: facets, directionality, transform

- [x] 2.1 Replace the single `weather` domain with three single-metric facet domains in `DOMAIN_METRICS` (`weather_temp`/`weather_precip`/`weather_wind`) and `WEIGHTS` (`{metric: 1.0}` each).
- [x] 2.2 Add `TAU_SECONDS` for `weather_precip` and `weather_wind` (~1 day, like `weather_temp`) and add both to `HIGH_FREQ` so they use `observation_daily`; keep the default 90-day self-relative baseline.
- [x] 2.3 Add `SIDED` config (`weather_temp:'both'`, `weather_precip:'high'`, `weather_wind:'high'`) and a per-metric transform config (`weather_precip` → `log1p`).
- [x] 2.4 Add per-facet incident floors (default `disrupted` for all three, mirroring Phase 1's `WEATHER_INCIDENT_FLOOR`).

## 3. Scoring engine: apply directionality + transform, register facets

- [x] 3.1 Apply `SIDED` in the four-state mapping so a `'high'` metric escalates only on the positive tail (negative z → operational) and `'both'` uses `abs(z)`; keep hysteresis and incident gating on `state` unchanged.
- [x] 3.2 Apply the precip transform (`log1p`) to the baseline series inside the z computation only; leave the stored raw mm untouched.
- [x] 3.3 Add `weather_temp`/`weather_precip`/`weather_wind` to the scoring-engine domain loop and to `INCIDENT_DOMAINS`; verify none are in `COMPOSITE_DOMAINS` and the composite stays `worst_of(markets, economy, relations)`.
- [x] 3.4 Generalize `_incident_title` from the single `weather` case to a per-facet map: temp → heat/cold anomaly (by sign), precip → flood risk, wind → wind event.

## 4. API

- [x] 4.1 Change `/api/weather` to return per country `{tempC (7-day mean), precipMm (7-day sum), windMax (7-day max), states:{temp,precip,wind committed}, ageMin}`, reading the three facet domains for state (not `domain='weather'`).
- [x] 4.2 Ensure a country with partial history is still returned with available aggregates and the missing facet reported `stale`; confirm `/api/incidents` serves the per-facet weather incidents and `/api/tiles` is unchanged.

## 5. Frontend: switchable choropleth

- [x] 5.1 Extend the weather fetch/types (`data/apiSource.ts`, types) to the new payload; fetch once and hold all three facets.
- [x] 5.2 Add a Temperature | Precipitation | Wind mode selector to the Meteorological panel (`OverlayPanel.tsx`), default Temperature, with a per-mode legend (temp diverging °C; precip sequential mm; wind sequential km/h).
- [x] 5.3 Make the globe choropleth (`Globe.tsx`) mode-aware: temp keeps the six-stop scale + latitude fallback; precip/wind use their sequential scales and render no fill without live data (no synthetic fallback).
- [x] 5.4 Generalize the numeric-label pass to the active mode (value + unit `°`/`mm`/`km/h`), still gated by size-LOD, near-hemisphere, and live-data-only.

## 6. Methodology + docs

- [x] 6.1 Document the faceted weather layer on the methodology page: precip's `log1p` flood-only anomaly and its zero-inflation caveat, wind's one-sided 7-day-max anomaly, temp's two-sided mean, that all facets are standalone (not in the composite), the per-facet `disrupted` incident floor, and that cloud is deferred to Phase 3.

## 7. Verification

- [x] 7.1 Confirm `weather_precip` and `weather_wind` observations are written for the tracked set from one batched call, and a provider outage skips the cycle (no crash, values go stale).
- [x] 7.2 Confirm each facet scores independently (single-metric z, no blending), `weather_precip` z is computed on `log1p`, and a one-sided low tail (calm week) stays operational while a high tail (gale) reaches disrupted.
- [x] 7.3 Confirm the composite/`/api/tiles` are unchanged with any weather facet disrupted, and old `domain='weather'` rows are harmlessly ignored.
- [x] 7.4 Confirm per-facet incidents: a synthetic flood (precip |z|≥2) opens exactly one `country:weather_precip` "flood risk"; a gale opens `country:weather_wind` "wind event"; a heat/cold spike opens `country:weather_temp` with the correct sign; each resolves independently on recovery; `news` still opens none.
- [x] 7.5 Confirm the overlay switches Temperature/Precipitation/Wind modes (choropleth, legend, labels update, no refetch), temp falls back to latitude on the fixtures path, and precip/wind show an honest empty state without live data.
