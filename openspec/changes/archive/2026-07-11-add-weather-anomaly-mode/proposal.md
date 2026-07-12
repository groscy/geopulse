## Why

The Meteorological overlay's Temperature/Precipitation/Wind modes paint **absolute** weekly values. But the signal GeoPulse actually computes — and the thing that drives incidents — is each facet's per-country **anomaly** (the z-score versus the country's *own* baseline). 42 °C in Dubai is normal-for-Dubai; a +3σ spike anywhere is the story. The per-facet committed state already rides in `/api/weather`, so surfacing the numeric z and letting the overlay color land by "how unusual is this here" is nearly free and often more informative than the raw value.

## What Changes

- **`/api/weather` exposes the per-facet anomaly z.** Alongside the existing per-facet `states`, the endpoint adds each facet's signed anomaly z (from the score row already persisted), so the client can render a continuous anomaly scale without any new scoring or a refetch.
- **A Value | Anomaly view toggle in the overlay.** The Meteorological overlay gains a second, orthogonal control (default **Value**, preserving today's behavior). The Temperature/Precipitation/Wind selector still chooses *which* facet; the Value/Anomaly toggle chooses *how* it's colored:
  - **Anomaly · temperature** — a **diverging** scale centered on zero (cool = unusually cold, warm = unusually hot), matching temperature's two-sided directionality.
  - **Anomaly · precipitation / wind** — a **sequential** scale from zero up the hazard (high) tail only; the non-hazard low tail renders neutral, honest to their one-sided directionality.
  - The legend and the numeric labels swap to the z scale (e.g. `+2.3σ`); facets with no anomaly yet (baseline warm-up) render neutral/stale, never a fabricated zero.

## Capabilities

### Modified Capabilities
- `api-service`: `GET /api/weather` additionally returns each facet's signed anomaly z (temp/precip/wind), leaving the existing aggregates, states, and every other endpoint unchanged.
- `meteorological-overlay`: adds a **Value/Anomaly** view toggle that colors the active facet by its per-country anomaly z on a per-facet anomaly scale (diverging for temperature, sequential-high for precip/wind), with a matching legend and z labels, using data already fetched (no refetch).

## Impact

- **backend**: `services/api/main.py` (`/api/weather` includes per-facet z, read from the existing facet `score` rows — no scoring change).
- **frontend**: `data/weather.ts` (per-facet anomaly scales + z formatting), `globe/Globe.tsx` (anomaly coloring path + z labels), `panels/OverlayPanel.tsx` (Value/Anomaly toggle + anomaly legend), `data/types.ts` (z fields), `state/*` (a view flag), `views/Methodology.tsx` (a note that the overlay can show the anomaly directly).
- **Database**: none — z is already persisted in the facet `score` rows.
- **External APIs**: none.
- **Out of scope**: any change to how the anomaly is computed (that is the separate climatology-baselines change); an anomaly view for the atmospheric field; composite participation.

## Depends On
- None active. Builds on the completed `add-weather-hazard-facets` (the facets and their per-facet state in `/api/weather`). Independent of the other queued weather changes; pairs naturally with `add-weather-climatology-baselines` (which improves the z this mode displays).
