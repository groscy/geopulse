## Context

Phases 1–2 made weather a set of per-country facets scored as self-relative z. The overlay shows the **absolute** weekly aggregate (mean °C, total mm, max km/h) and reflects anomalies only indirectly (the panel's anomaly list, incidents). Yet the z is the honest cross-country signal, and it is already computed and stored (each facet's `score.value` is its signed z) and partly exposed (`/api/weather.states` carries the committed state). This change closes the last step: expose the numeric z and let the overlay paint it.

## Goals / Non-Goals

**Goals:**
- Let the overlay color land by each facet's per-country **anomaly**, not just its absolute value, reusing data already computed — no new scoring, no refetch.
- Keep the absolute modes exactly as they are (default), adding anomaly as an orthogonal view.
- Respect each facet's directionality in the anomaly scale (temp two-sided, precip/wind high-only).

**Non-Goals:**
- No change to *how* the z is computed (climatology/percentile is a separate change).
- No anomaly view for the atmospheric field (it has no z).
- No new persisted data — z is read from existing `score` rows.

## Decisions

- **Surface z from the existing `score` rows; don't recompute.** `/api/weather` already joins each country's facet `score` for `states`; that same row's `value` is the signed z. The endpoint adds `z: {temp, precip, wind}` (nullable where stale). Rationale: zero scoring change; the anomaly the map shows is exactly the one that drives incidents. *Alternative rejected:* a separate `/api/weather-anomaly` endpoint — needless; the payload already carries the facets.

- **Value/Anomaly is a second orthogonal toggle, not a fourth mode.** The facet selector (Temp/Precip/Wind) picks *which* facet; a Value|Anomaly switch picks *how*. Default **Value**. Rationale: absolute and anomaly are two lenses on the same three facets; a 3×2 matrix as two small toggles is clearer than six flat modes. *Alternative rejected:* six modes in one selector — combinatorial and confusing.

- **Per-facet anomaly scales honor directionality.** Temperature → a **diverging** scale centered at z=0 (cool blues below baseline, warm reds above), since it escalates on either tail. Precip/wind → a **sequential** scale from z=0 up the positive tail; z ≤ 0 renders neutral because the low tail is not a hazard (a calm/dry week is not "anomalously safe" worth coloring). Rationale: the scale *is* the directionality made visible; it matches `SIDED`. Clamp to the scoring clamp (±4). *Alternative rejected:* one diverging scale for all — would paint calm/dry weeks as strong "cool" anomalies, contradicting the one-sided semantics.

- **Anomaly labels + legend swap with the view.** In anomaly view the LOD numeric labels show the z (e.g. `+2.3σ`) and the legend shows the z scale; both reuse the existing metric-agnostic label/legend machinery. Rationale: consistency with the Value modes; the label pass is already value+unit-parameterized.

- **Live-data-only, no synthetic anomaly.** Anomaly coloring draws only where a facet's z is present; countries in baseline warm-up (null z) render as the stale hatch/neutral. There is no latitude-style fallback for an anomaly — same honesty rule as precip/wind absolute modes. Rationale: never present a fabricated anomaly as real.

## Risks / Trade-offs

- **Sparse anomaly early on.** Until baselines warm, many facets have null z, so anomaly view is patchy. → Honest (stale hatch); the absolute Value view remains the default and is always populated.
- **Diverging-scale legibility over the dark globe.** → Choose accessible cool/warm endpoints with enough contrast at the mid (near-zero) band so "normal" reads as muted, not invisible.
- **Users conflating value and anomaly.** → The legend and the toggle label make the active lens explicit; default Value preserves the familiar view.

## Migration Plan

Additive, reversible. (1) `/api/weather` adds `z` per facet (read-only, from existing rows). (2) Frontend: anomaly scales in `data/weather.ts`, a Value/Anomaly toggle in the panel, the anomaly coloring + z-label path in the globe, a view flag in state. (3) Methodology note. **Rollback:** drop the toggle (overlay stays on Value) and stop reading `z`; nothing else depends on it.

## Open Questions (resolved with v1 defaults)

- **Color by z or by committed state?** → By **z** (continuous), clamped to ±4; the committed state still drives incidents and the panel list.
- **Precip/wind low tail?** → **Neutral** (uncolored) — one-sided, so only the hazard tail is painted.
- **Default view?** → **Value**, preserving current behavior; anomaly is opt-in per session.
