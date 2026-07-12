## Context

The drill-down (`GET /api/countries/{iso3}` → `CountryDrilldown.tsx`) is GeoPulse's auditability surface: composite → per-domain states → contributing metric rows (value, source, timestamp, sparkline). News was added as a **standalone** domain block here in its own change. Weather facets are scored per country exactly like the others but were never wired into the drill-down — a gap now that they drive real incidents. This change fills it, reusing the existing decomposition shape.

## Goals / Non-Goals

**Goals:**
- Make the per-country weather facets visible and auditable in the drill-down, consistent with the other domains.
- Reuse the existing metric-row / domain-chip pattern — no new component vocabulary.
- Be forward-compatible: new facets (drought) appear automatically without another change.

**Non-Goals:**
- No composite change (weather stays standalone, like News).
- No global objects (field, storms) in the drill-down — it is a per-country breakdown.
- No new persisted data.

## Decisions

- **Reuse the metric-row shape for facets.** Each weather facet is returned as a row `{key, label, value (formatted, with unit), state, ageMin, z, series}` — the same shape the standard/news metrics already use — so the frontend renders it with the existing row component and the drill-down grows a **Weather** section beside News. Rationale: zero new UI primitives; visually consistent; auditable (value+age+series). *Alternative rejected:* a bespoke weather widget — unnecessary divergence from the established decomposition.

- **Aggregate per-facet server-side, reusing `/api/weather` semantics.** For the one country, temperature = 7-day mean, precip = 7-day total, wind = 7-day max (and drought when present), each with the facet's committed `state` and signed `z` from its `score` row and the reading age. Rationale: one source of truth for the aggregates; the drill-down and the overlay agree. *Alternative rejected:* recompute differently in the drill-down — risks divergence from the overlay.

- **Include facets that exist; don't hardcode the set.** The section lists whatever weather facets have a `score` row for the country, so `weather_drought` (from the climatology change) appears with no further work. Rationale: forward-compatibility; the faceted model is open-ended. *Alternative rejected:* a fixed temp/precip/wind list — would need editing for every new facet.

- **Label the section standalone.** The Weather section is marked as not feeding the composite (same one-line framing as News), so the auditability story stays honest. Rationale: consistency with how weather is described everywhere else.

## Risks / Trade-offs

- **Facet without enough history renders stale.** → Shown as `stale`/`—` like any warm-up metric; honest.
- **Drill-down query cost grows slightly** (a few more `score`/`observation` reads per country). → Bounded (a handful of facets), same pattern as the existing per-metric reads.

## Migration Plan

Additive, reversible. (1) `/api/countries/{iso3}` adds the weather section (read-only, from existing rows). (2) Frontend maps and renders the Weather section in the drill-down. **Rollback:** stop returning/rendering the section — no other surface depends on it.

## Open Questions (resolved with v1 defaults)

- **Where in the drill-down?** → A **standalone Weather section** beside News (both are non-composite standalone domains).
- **Which value per facet?** → The same aggregate the overlay shows (mean °C / total mm / max km/h), plus state, z, and age.
- **Fixed or dynamic facet list?** → **Dynamic** — render whatever facets have scores, so drought appears automatically.
