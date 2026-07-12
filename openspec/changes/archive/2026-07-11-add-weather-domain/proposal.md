## Why

GeoPulse already ships a **Meteorological** overlay — a temperature choropleth and five storm spirals — but it is entirely synthetic: the temperature is `31 − |lat|·0.72 + noise` (a latitude gradient, [`Globe.tsx` `tempColor`](../../../frontend/src/globe/Globe.tsx)) and the storms are five hardcoded positions ([`data/overlays.ts` `STORMS`](../../../frontend/src/data/overlays.ts)). The overlay file even labels itself `DEMO / REFERENCE DATA … Not live feeds`.

We want weather to be a **real, analytical signal**, not eye-candy: display each country's **average weekly temperature** on the globe, and treat temperature as a per-country risk input the same way every other GeoPulse metric is treated — z-scored against the country's own recent baseline, so a genuine heat/cold **anomaly** (hotter/colder than *that* country's normal) surfaces, while "hot in Dubai in summer" correctly reads as normal.

This is a post-M4 enhancement. It reuses the M1 scoring/staleness machinery, the M2 hysteresis, and the M2 incident lifecycle unchanged, and it **folds into the existing Meteorological overlay** rather than adding a new Health metric to the left rail. It is Phase 1 of a larger weather roadmap; the later phases (a 3D atmospheric field shell for clouds/wind/rain, and live storm tracks) are scoped but deferred — see `design.md` → Roadmap.

## What Changes

- **weather-worker (new, keyless)** — a new ingestion worker on its own cadence samples current surface temperature at each tracked country's representative point (centroid/capital) from **Open-Meteo** (no API key, like `fx-worker`/`gdelt-worker`/`macro-worker`) and emits `metric='weather_temp'` point `Observation` rows (`source='open-meteo'`). It degrades gracefully on provider failure (skip cycle, keep last-known), like every other worker.
- **scoring-engine** — add a `weather` domain scored through the existing generic weighted-rollup path (`score_domain`), with per-metric weight, staleness τ, four-state mapping, and hysteresis exactly like the other point-based domains. The z-score against the country's own **90-day self-relative baseline** (the "cheap" anomaly — see design) turns raw temperature into a per-country anomaly. **`weather` is EXCLUDED from the worst-of composite** (like `news`): it is persisted, colored, and drives its own incidents, but never moves a country's composite state.
- **incident-detection** — decouple incident-eligibility from composite-membership so the standalone `weather` domain can open `country:weather` incidents (heat/cold anomalies) through the existing incident schema/dedup/resolution, while `news` remains incident-free. To keep the feed clean, weather incidents open only at the **`disrupted`** floor (|z| ≥ 2) in v1.
- **api** — add `GET /api/weather` returning, per country, the **7-day mean surface temperature (°C)** and the country's committed weather anomaly state; weather incidents flow through the existing `/api/incidents` unchanged.
- **frontend** — the existing Meteorological overlay becomes **data-backed**: `tempColor` fills land by real 7-day-mean temperature (via `/api/weather`) instead of latitude, keeping the same six-stop scale and legend; it falls back to the current latitude tint when no live data is available (demo/fixtures path). **No new Health metric** is added — this enriches the overlay that already exists. Storm spirals stay decorative in v1 (made real in Phase 4).
- **No database migration** — `observation.metric` and `score.domain` are free-text; the new `weather_temp` metric and `domain='weather'` rows are additive data.

## Capabilities

### New Capabilities
- None. This change layers a new scored domain onto existing capabilities and makes an existing overlay data-backed.

### Modified Capabilities
- `data-ingestion`: a new keyless `weather-worker` emits per-country `weather_temp` point observations from Open-Meteo.
- `scoring-engine`: a new `weather` domain is scored via the standard rollup but excluded from the worst-of composite.
- `incident-detection`: incident-eligibility is decoupled from composite-membership; the `weather` domain opens heat/cold-anomaly incidents.
- `meteorological-overlay`: the temperature choropleth is sourced from live per-country weekly-average temperature instead of a synthetic latitude model.
- `api-service`: a new `GET /api/weather` endpoint serves per-country weekly-mean temperature + anomaly state.

## Impact

- **Backend**: new `services/weather-worker/main.py` (Open-Meteo point sampling → `weather_temp` obs); `services/common/config.py` (`WEATHER_INTERVAL`, Open-Meteo base URL, `WEATHER_POINTS` centroid/capital table, `DOMAIN_METRICS['weather']`, `WEIGHTS['weather']`, `TAU_SECONDS['weather_temp']`, add `weather_temp` to `HIGH_FREQ`, weather incident floor); `services/scoring-engine/main.py` (score `weather` in the domain loop; keep it out of `COMPOSITE_DOMAINS`; introduce an `INCIDENT_DOMAINS` set so `weather` opens incidents while `news` does not).
- **api**: `services/api/main.py` (new `/api/weather` endpoint: per-country 7-day mean temp from `observation_daily` + committed `weather` state).
- **frontend**: `globe/Globe.tsx` (`tempColor` reads a fetched `/api/weather` map, latitude fallback), `panels/OverlayPanel.tsx` (Meteorological panel shows real values), `data/apiSource.ts` (weather fetch) — no change to the Health single-select, `HealthMetric`, or the composite choropleth.
- **Deployment**: register `weather-worker` in `docker/supervisord.conf` and `docker-compose.yml` (built from the same `services/Dockerfile` image as the other workers).
- **Database**: no migration (free-text `metric`/`domain`).
- **External APIs**: Open-Meteo added — keyless, no auth, CC-BY (attribution on the methodology page).
- **Out of scope (deferred to later phases — see design Roadmap)**: the point-scalar suite `weather_precip`/`weather_wind`/`weather_cloud` (Phase 2); the **3D atmospheric field shell** for clouds/wind/rain via a `weather-field-worker` + cached grid + `GET /api/weather-field` (Phase 3); **live storm tracks** replacing the decorative spirals via a `storm-worker` (NHC/JTWC) (Phase 4); a proper day-of-year **climatology baseline** replacing the cheap 90-day self-baseline; `weather` participation in the composite; a weather chip in the country drill-down.

## Depends On
- None active. Builds on the archived M1–M4 specs (`data-ingestion`, `scoring-engine`, `incident-detection`, `meteorological-overlay`, `api-service`), already merged into `openspec/specs/`.
