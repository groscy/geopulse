## Why

M1 renders composite health but says nothing about *what changed and why*, and it is a static poll. Milestone M2 turns the skeleton into an operations console: it detects threshold crossings and records them as incidents, streams live tile/incident diffs to the client, and gives every country a drill-down panel that decomposes its state into domains, metrics, sparklines, relations, and active incidents. This is where GeoPulse starts to read like the AWS Health Dashboard it is modeled on.

This change delivers M2 and satisfies FR-3 (drill-down), FR-4 (incident feed), FR-5 (staleness indicators), NFR-4 (score stability / hysteresis), and NFR-6 (auditability through the UI).

## What Changes

- Add **hysteresis** to the scoring engine (NFR-4): a tile must hold a new state for N consecutive evaluations (default N=3) before flipping; enter a worse state at |z|=1.0, recover below |z|=0.7. Prevents flapping now that scores update live.
- Add a **threshold detector**: when a metric or domain crosses a configured threshold, open an `incident` row (severity, affected countries, triggering metric, start time); close it (`resolved_at`) when it recovers.
- Add a **live update channel**: an SSE stream on the API pushing tile-state diffs and incident open/close events; the frontend subscribes and updates without polling (ADR-004).
- Add the **country drill-down panel** (right panel, 380px): composite state banner, three domain chips, six key-metric rows with sparklines + source·age + delta, top bilateral relations by |tone|, and active incidents for the country.
- Add the **global incident feed** (default right panel) with All / Ongoing / Resolved filters and an **incident detail modal** containing the threshold line chart (series, dashed threshold line, breach marker, baseline μ±σ).
- Add **staleness indicators** everywhere values appear (FR-5): every metric shows its source and age; values computed from stale data are visually flagged (grey hatch / clock), never silently shown as current.

## Capabilities

### New Capabilities
- `incident-detection`: threshold crossing → incident lifecycle (open/resolve) in the scoring engine, plus the hysteresis state-transition rules that keep states stable.
- `live-updates`: the SSE stream on the API and the frontend subscription that applies tile/incident diffs in real time.
- `country-drilldown`: the right-panel per-country view — composite banner, domain chips, key-metric sparklines, top relations, active incidents.
- `incident-feed`: the global chronological incident list with filters and the incident-detail modal with its threshold chart.
- `staleness-indicators`: the cross-cutting source+age display and stale visual flagging in the panel, feed, and on the map.

### Modified Capabilities
<!-- None declared as deltas: M1 specs are not yet archived, so M2 introduces its behavior as new capabilities. The hysteresis/threshold logic layers onto the existing scoring-engine capability at implementation time. -->

## Impact

- **scoring-engine**: gains hysteresis state memory (previous states + consecutive-eval counters) and the threshold detector; writes the new `incident` table.
- **api**: gains an SSE endpoint (`GET /api/stream`) and incident endpoints (`GET /api/incidents`, `GET /api/incidents/{id}`); country endpoint extended to return sparkline series and top relations.
- **frontend**: gains the right-panel router (feed ⇄ drill-down), the incident modal, SSE client, and staleness rendering.
- **New table**: `incident(id, severity, countries[], metric, threshold, started_at, resolved_at, title, detail jsonb)`.
- **Out of scope**: additional data sources, relations arc layer on the globe, methodology page (M3); retention/profiles (M4).

## Depends On
- m1-walking-skeleton
