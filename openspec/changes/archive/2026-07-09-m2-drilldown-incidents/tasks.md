## 1. Incident schema

- [x] 1.1 Migration: create `incident(id uuid pk, severity, countries char(3)[], metric, threshold, started_at, resolved_at, title, detail jsonb)`.
- [x] 1.2 Add indexes for feed queries: `(resolved_at)` and `(started_at desc)`; GIN on `countries`.

## 2. Hysteresis in the scoring engine

- [x] 2.1 Add per-(country, domain) state memory: candidate state + consecutive-eval counter, persisted across runs.
- [x] 2.2 Implement asymmetric bands: enter worse state at |z|=1.0, recover below |z|=0.7.
- [x] 2.3 Commit a state flip only after N (default 3, config) consecutive confirmations; otherwise hold.
- [x] 2.4 Unit-test flap resistance: single-cycle spike does not flip; sustained change does.

## 3. Threshold detector & incident lifecycle

- [x] 3.1 Load per-metric/per-domain threshold config; evaluate crossings each scoring cycle.
- [x] 3.2 Open an incident on breach (severity, countries, metric, threshold, title, started_at, detail) with no duplicate while active.
- [x] 3.3 Resolve an incident (set `resolved_at`) when its condition recovers under the hysteresis recovery rule.
- [x] 3.4 Populate `detail jsonb` with the decomposition needed by the modal (series ref, z, baseline μ±σ).

## 4. API: live stream & incident endpoints

- [x] 4.1 Implement `GET /api/stream` (SSE) emitting `tile` and `incident` events; add heartbeat + disable proxy buffering on the route.
- [x] 4.2 Emit a `tile` event when a persisted composite state changes; emit `incident` events on open/resolve.
- [x] 4.3 Implement `GET /api/incidents` (with All/Ongoing/Resolved filtering) and `GET /api/incidents/{id}`.
- [x] 4.4 Extend `GET /api/countries/{iso3}` to return per-domain states, six key-metric series (sparklines) with source·age, top relations by |tone|, and active incidents.

## 5. Frontend: right-panel router & drill-down

- [x] 5.1 Add selection model (`selected`, `modal`) and route the right panel between feed / drill-down / modal.
- [x] 5.2 Build the drill-down: flag + name + region, tinted composite banner with source·age.
- [x] 5.3 Build the three domain chips (Economy/Markets/Relations) colored by domain state.
- [x] 5.4 Build the six key-metric rows: label, source·age, SVG sparkline, value, state-colored delta, trailing dot; render missing metrics as stale.
- [x] 5.5 Build top-relations rows with tone gradient bar + z marker (z ∈ [−2,2]).
- [x] 5.6 Build active-incident cards in the drill-down; clicking opens the modal.

## 6. Frontend: incident feed & modal

- [x] 6.1 Build the global feed (default panel): active count, All/Ongoing/Resolved chips, incident cards (severity dot, title, flags, metric, since, status badge), newest-first.
- [x] 6.2 Card click selects the incident's country → drill-down; chart icon opens the modal (stop propagation).
- [x] 6.3 Build the incident detail modal: header, SVG line chart with dashed threshold line + breach marker + axis ticks, μ±σ / current-z / affected stat cards, explanatory paragraph; close on backdrop/✕.

## 7. Frontend: live updates & staleness

- [x] 7.1 Implement the SSE client with auto-reconnect; apply `tile`/`incident` diffs to in-memory state; refetch tiles on reconnect.
- [x] 7.2 Recolor globe, update top-bar counts, and animate feed changes from diffs (no full reload).
- [x] 7.3 Add the freshness indicator ("Live · updated Ns ago") resetting on each event.
- [x] 7.4 Apply staleness treatment everywhere: map hatch, panel/feed clock+hatch, driven by shared per-metric age thresholds.

## 8. Verification

- [x] 8.1 Force a synthetic breach and confirm: incident opens → SSE `incident` event → feed card appears → modal chart shows the breach marker.
- [x] 8.2 Confirm hysteresis: oscillate a metric near a boundary and verify the map/incident do not flap.
- [x] 8.3 Confirm recovery closes the incident and updates the badge live.
- [x] 8.4 Confirm a stale country reads as hatched on the map and stale in the panel, with source·age shown on every metric.
- [x] 8.5 Confirm drill-down auditability: composite → domains → metric series → source/ts all resolve for a selected country.
