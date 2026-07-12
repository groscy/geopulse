## 1. Climatology normals store + fetch

- [x] 1.1 Add a `weather_normal` store (country, day-of-year, metric, mean, sd) via the migration path, isolated from `observation`; add upsert/read helpers in `services/common/db.py`.
- [x] 1.2 Add a keyless Open-Meteo climate-normals fetch (rare cadence — in `weather-worker` or a small step) that populates `weather_normal` for the tracked points/metrics; graceful skip on failure (last-known normals kept).

## 2. Scoring: climatology baseline + percentile + drought

- [x] 2.1 Add a per-metric **day-of-year climatology** baseline mode in `scoring-engine/main.py` (±N-day smoothing window), used in the z path with **fallback** to the 90-day self-window when no normal exists.
- [x] 2.2 Replace the `weather_precip` `log1p`-Gaussian z with an **empirical-CDF percentile** anomaly mapped to the z bands; keep raw mm stored/displayed; fall back to `log1p`/stale on thin history.
- [x] 2.3 Add the **`weather_drought`** facet in `config.py` (`DOMAIN_METRICS`/`WEIGHTS` over `weather_precip`, `SIDED='low'`, τ, disrupted floor, long deficit window) and in the scoring loop + `INCIDENT_DOMAINS`; keep it out of `COMPOSITE_DOMAINS`.
- [x] 2.4 Compute `weather_drought` as a seasonal accumulation deficit vs the climatological normal over the long window; generalize `_incident_title` with a "drought" case.

## 3. Methodology + docs

- [x] 3.1 Replace the "cheap 90-day self-window" and "flood-only precip" methodology caveats with the climatology baseline (with fallback), the percentile precip anomaly, and the drought dry-tail facet.

## 4. Verification

- [x] 4.1 Confirm a facet with a normal scores against the day-of-year climatology (seasonal drift removed) and falls back to the self-window when no normal exists; normals do not change live coverage math.
- [x] 4.2 Confirm `weather_precip` z is a percentile anomaly (not `log1p`) with raw mm preserved, and a synthetic wet spike/dry spell scores as expected.
- [x] 4.3 Confirm a sustained deficit opens exactly one `country:weather_drought` "drought" incident (low tail), a wet period opens none, drought resolves independently, and the composite/other facets are unaffected.
