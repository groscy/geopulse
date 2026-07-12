## Context

The scoring spine computes `z = (x − μ) / σ` against each country's **own recent baseline** — for weather, the default 90-day self-window via `observation_daily`. Two honest weaknesses, both documented on the methodology page and in the Phase-1/2 designs:

1. **Seasonal drift** — a 90-day window that spans a change of season biases μ, so "anomaly" means "vs the recent past," not "vs the seasonal normal." The named fix is a **day-of-year climatology**.
2. **Precip is skewed + flood-only** — `log1p`-Gaussian z tames the skew approximately; the named clean fix is a **percentile / empirical-CDF** anomaly. **Drought** was deferred because the dry tail on a 90-day daily self-window is a wall of zeros.

This change delivers all three, reusing the facet machinery (`SIDED`, per-metric transform, per-facet incidents) added in Phase 2.

## Goals / Non-Goals

**Goals:**
- Make the anomaly "vs the seasonal normal" via a day-of-year climatology, with a safe fallback to the current self-window so nothing regresses during warm-up.
- Score precipitation with a distribution-appropriate **percentile** anomaly instead of `log1p`-Gaussian.
- Detect **drought** as its own dry-tail facet on a seasonal-deficit baseline.
- Keep the composite, the other facets' identities, and the API/overlay contracts stable.

**Non-Goals:**
- No sub-national / gridded climatology — one normal per tracked point, as with the point facets.
- No UI beyond a methodology note (the anomaly-mode and drilldown changes consume the results).
- No change to markets/economy/relations baselines — weather only.

## Decisions

- **Day-of-year climatology with self-window fallback, applied in the z path only.** A new per-metric baseline mode selects, for the latest value, a climatological `(μ, σ)` for **this country and this day-of-year** (a smoothing window of ±N days around the date) instead of the flat 90-day mean/σ. Source of the normal: keyless **Open-Meteo climate normals** fetched rarely and cached in a `weather_normal` table (country, day-of-year, metric, mean, sd); if a normal is missing (warm-up / unsupported metric) the code **falls back to the existing 90-day self-window**. The raw observations and their storage are untouched — only the baseline `(μ, σ)` the z is measured against changes. Rationale: removes seasonal drift, keeps the anomaly self-relative and per-country, and never blanks (fallback). *Alternative rejected:* accumulate day-of-year stats purely from our own history — correct but needs years of data before it beats the self-window; the fetched normal works immediately, and accumulation can supersede it later.

- **Percentile precip anomaly replaces `log1p`.** For `weather_precip`, compute the current accumulation's **empirical-CDF percentile** within the country's historical precip distribution (climatology-conditioned where available), then map the percentile to an anomaly magnitude (e.g. via the normal quantile) for the four-state thresholds. Rationale: robust to zero-inflation and skew without a Gaussian assumption — the deferred "clean fix." The stored raw mm is unchanged (display stays real accumulation). *Alternative rejected:* keep `log1p` — approximate; a rare storm in a dry country still over-reads.

- **`weather_drought` is a new `low`-sided facet on a seasonal-deficit baseline.** Register `weather_drought` like the other facets (single-metric domain, `WEIGHTS {weather_precip: 1.0}` computed over a **longer accumulation window** vs its climatological normal), `SIDED = 'low'` (deficit only), disrupted floor, `country:weather_drought` incident titled "drought." It shares the precip metric but a different (long, deficit) baseline — the mechanism is the facet's baseline config, not a new observation. Rationale: reuses all Phase-2 machinery (`_dir_mag('low')` already exists); flood (`weather_precip`, high) and drought (`weather_drought`, low) become the two tails, each honest on its own window. *Alternative rejected:* make `weather_precip` two-sided — conflates a fast flood signal (short window) with a slow deficit signal (long window); they need different baselines.

- **Normals fetched rarely, isolated from the fresh-value store.** The climatology is quasi-static, so a rare fetch (e.g. monthly, or on first sight of a country) into `weather_normal` is enough; it does **not** go through the `observation` hypertable (which encodes freshness/coverage for live values). Rationale: climatology has no "staleness" in the live sense; keeping it separate avoids corrupting coverage math.

## Risks / Trade-offs

- **Climatology source coverage / gaps.** A point may lack a normal for a metric. → Per-metric, per-country fallback to the 90-day self-window; the facet still scores, just without the seasonal correction, and the methodology page states which mode is active.
- **Percentile needs enough history.** Early on the empirical CDF is thin. → Below a minimum sample the precip facet falls back to the `log1p` path (or stays stale), same warm-up discipline as every metric.
- **Drought is slow and window-sensitive.** A deficit signal depends on the accumulation window length. → Config-tunable window; disrupted-only floor + hysteresis damp noise; documented as a seasonal-scale signal, not a daily one.
- **Two precip facets (flood + drought) could co-fire confusingly.** → They are opposite tails on different windows and rarely both extreme at once; each is its own incident, consistent with the faceted model.

## Migration Plan

Additive, reversible. (1) Add the `weather_normal` table + a rare climatology fetch. (2) scoring-engine: a climatology baseline mode (fallback to self-window) in the z path; the percentile anomaly for `weather_precip`; the `weather_drought` facet in the loop + `INCIDENT_DOMAINS` + `_incident_title`. (3) config: climatology/percentile settings, `weather_drought` facet entries (`SIDED='low'`, floor, τ, deficit window). (4) methodology page update. **Rollback:** drop the climatology mode (facets revert to the 90-day self-window), restore `log1p` for precip, and remove `weather_drought` from the loop — the other facets, the composite, and the API are unaffected because the change is confined to the baseline/anomaly computation plus one additive facet.

## Open Questions (resolved with v1 defaults)

- **Fetch normals or accumulate them?** → **Fetch** keyless Open-Meteo normals now (works immediately); accumulation can supersede later.
- **Percentile → magnitude mapping?** → Map the empirical percentile through the normal quantile so the existing z-band thresholds (1/2) still apply.
- **Drought: reuse precip or new metric?** → Reuse the `weather_precip` observations, new **facet** with a long deficit-vs-normal baseline and `SIDED='low'`.
- **Any UI in this change?** → Only the methodology note; the drought facet surfaces through the anomaly-mode and drill-down changes.
