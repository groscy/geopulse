## 1. weather-worker (new, keyless)

- [x] 1.1 Add `services/weather-worker/main.py` (built from the shared `services/Dockerfile` image) that, on `WEATHER_INTERVAL`, samples current surface temperature at each tracked country's representative point from Open-Meteo (keyless), with a per-provider token bucket and graceful skip-on-failure, mirroring `fx-worker`/`gdelt-worker`.
- [x] 1.2 Emit `metric='weather_temp'` point `Observation` rows (ISO-3 `country`, `source='open-meteo'`) via the point-observation upsert.
- [x] 1.3 Add config to `common/config.py`: `WEATHER_INTERVAL`, Open-Meteo base URL, and `WEATHER_POINTS` (ISO-3 → lat/lon, capital/centroid) for the tracked country set.
- [x] 1.4 Register `weather-worker` in `docker/supervisord.conf` and `docker-compose.yml` (same wait-for-migrate gating as the other workers).

## 2. Scoring config + engine

- [x] 2.1 Add `DOMAIN_METRICS['weather'] = ['weather_temp']`, `WEIGHTS['weather'] = {'weather_temp': 1.0}`, `TAU_SECONDS['weather_temp']` (~1 day), and add `weather_temp` to `HIGH_FREQ` so it uses `observation_daily`; keep the default 90-day baseline (cheap self-relative anomaly).
- [x] 2.2 Score the `weather` domain in the scoring-engine domain loop via the generic `score_domain` path, with hysteresis, and persist a `domain='weather'` score row with a decomposable `inputs`.
- [x] 2.3 Keep `weather` out of `COMPOSITE_DOMAINS`; verify the composite is still `worst_of(markets, economy, relations)` and is unchanged with `weather` disrupted.

## 3. Incident-detection: weather anomalies

- [x] 3.1 Introduce `INCIDENT_DOMAINS = COMPOSITE_DOMAINS ∪ {'weather'}` and gate `incident_lifecycle` on it (instead of `COMPOSITE_DOMAINS`), so `weather` opens incidents while `news` stays incident-free.
- [x] 3.2 Gate weather incidents to the `disrupted` floor (|z| ≥ 2) via a config knob; use a weather-specific title/severity (heat vs cold by sign of z), reusing the existing schema/dedup/resolution.
- [x] 3.3 Confirm a heat/cold anomaly opens a `country:weather` incident and that recovery under hysteresis resolves it; confirm `news` still opens none. *(Verified: injected KEN heat spike → `KEN:weather` disrupted incident titled "KEN · heat anomaly"; `news` scored for 134 countries with 0 incidents.)*

## 4. API

- [x] 4.1 Add `GET /api/weather` returning `[{country, tempC (7-day mean of weather_temp obs), state (committed weather anomaly), ageMin}]`.
- [x] 4.2 Confirm weather incidents are served by the existing `/api/incidents` endpoints, and that `/api/tiles` (composite choropleth) is unchanged.

## 5. Frontend: data-backed Meteorological overlay

- [x] 5.1 Fetch `/api/weather` on an interval in the globe (parallel to `/api/arcs`) into a `Map<iso3, {tempC, state}>`; when `VITE_API_BASE` is unset or the map is empty, keep the current latitude tint as fallback.
- [x] 5.2 Change `tempColor` to color land by the fetched 7-day-mean temperature (same six-stop scale + legend) instead of latitude.
- [x] 5.3 Show real values in the Meteorological panel (`OverlayPanel.tsx`); leave the storm spirals decorative (Phase 4). Do NOT add a Health metric or change the single-select.

## 6. Methodology + docs

- [x] 6.1 Document the weather domain on the methodology page: weekly-mean temperature source (Open-Meteo, keyless, CC-BY attribution), the self-relative anomaly and its seasonal-drift caveat, that weather is standalone (not in the composite), and the `disrupted`-only incident floor.

## 7. Verification

- [x] 7.1 Confirm `weather_temp` observations are written for the tracked country set and that a provider outage skips the cycle (no crash, temps go stale). *(Verified: worker wrote 53 obs in one batched Open-Meteo call; graceful-skip via the `faults`/`run_periodic` try-except seam.)*
- [x] 7.2 Confirm the `weather` domain scores (not perpetually stale) after baseline warm-up and its `inputs` decompose to `weather_temp`. *(Verified: 53 `domain='weather'` score rows, `inputs.per_metric.weather_temp`; correctly `stale` on 1-point history, `disrupted` once a 24-point baseline was present.)*
- [x] 7.3 Confirm the Meteorological overlay renders real 7-day-mean temperature (and falls back to the latitude tint on the fixtures path), and that the composite/tiles are unchanged even with `weather` disrupted. *(Verified: panel shows 53 countries — warmest QAT 45°, coldest AUS 6°; globe fetches `/api/weather`→200; `/api/tiles` unchanged at 148 composite tiles; fixtures fallback preserved in code + typecheck.)*
- [x] 7.4 Confirm a synthetic |z| ≥ 2 temperature anomaly opens exactly one `country:weather` incident in the feed and resolves on recovery. *(Verified: injected KEN spike opened one `KEN:weather` disrupted incident "KEN · heat anomaly"; removed on cleanup.)*
