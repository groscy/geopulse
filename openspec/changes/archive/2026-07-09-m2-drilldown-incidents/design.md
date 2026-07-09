## Context

M1 produced a static, polled, composite-only globe. M2 makes it live and explanatory. Two things change in kind: the scoring engine gains *memory* (hysteresis + incident lifecycle across evaluations), and the client gains a *push* channel (SSE) and a much richer right panel. The design handoff (`design_handoff_geopulse/`) specifies the exact panel/feed/modal layout, colors, and sample data — this milestone realizes those against real scores.

Constraints unchanged from M1: local-first, auditability, staleness as a first-class state, 60 fps globe.

## Goals / Non-Goals

**Goals:**
- Scores stop flapping: state changes are damped by hysteresis (NFR-4) so the map is stable enough to trust.
- Every threshold crossing becomes a first-class, auditable incident with a start and (eventually) a resolution.
- The client updates live over one server→client channel; no polling for steady-state.
- A selected country is fully explainable in the panel: composite → domains → metrics (with sparklines, source, age) → relations → incidents.
- Staleness is visible everywhere a value appears.

**Non-Goals:**
- New data sources (FX/macro/conflict), relations arcs on the globe, methodology page — M3.
- Retention policies, continuous aggregates, chaos testing, lite/full profiles — M4.
- Multi-user, auth, historical replay beyond 90d — out of v1.

## Decisions

- **Hysteresis as engine state, not UI smoothing.** The engine persists, per (country, domain), the candidate state and a consecutive-evaluation counter; a flip commits only after N confirmations, with asymmetric enter/recover bands (1.0 / 0.7). Rationale: the *stored* state must be stable so incidents and the SSE diffs are stable; smoothing in the UI would leave incidents flapping. Alternative (EMA of z) rejected — harder to explain in the methodology page than an explicit hold-count.
- **Incident lifecycle keyed by (country, metric, threshold).** One active incident per key; re-breach while active is a no-op; recovery under the hysteresis rule sets `resolved_at`. Rationale: prevents duplicate spam and gives a clean ongoing/resolved distinction for the feed.
- **SSE emits diffs, client keeps the model (ADR-004).** The stream carries only `tile` (country → new state) and `incident` (id → status) events; the client holds the full tile/incident model in memory and applies diffs, refetching only on reconnect to reconcile. Rationale: minimal bandwidth, matches the low-frequency server→client nature; WebSockets' bidirectionality is unused.
- **Panel is a router over one selection model.** `selected` (country|null) and `modal` (incidentId|null) drive whether the panel shows the feed, a drill-down, or the modal — mirroring the design handoff's single-component state. Rationale: keeps the feed⇄drill-down⇄modal transitions trivial and consistent.
- **Sparkline series come from the store, not recomputed client-side.** The country endpoint returns recent per-metric series so the client just draws SVG paths. Rationale: the server already has the observations; avoids duplicating windowing logic.
- **Staleness thresholds are per-metric (τ/max-age from config), shared by engine and UI.** One config source of truth so the map hatch, the panel clock, and the scoring discount agree.

## Risks / Trade-offs

- **Hysteresis hides fast real events.** A genuinely abrupt crisis takes N evaluations to show. → Keep N configurable (default 3) and allow a severity-scaled fast path for extreme z if tuning in M4 shows it is needed; document the lag on the methodology page (M3).
- **SSE through dev proxies / buffering.** Some proxies buffer SSE. → Send periodic heartbeat comments and disable proxy buffering for the stream route; client auto-reconnect + refetch reconciles any missed diff.
- **Incident churn at boundaries.** Metrics oscillating near a threshold could still open/close incidents. → The incident lifecycle inherits the hysteresis bands (open on enter-band, resolve on recover-band), not the bare threshold.
- **Panel/feed re-render cost on frequent diffs.** → Diffs are per-country/per-incident; memoize rows and only re-render the affected card/tile.

## Migration Plan

Additive over M1. Steps: (1) add the `incident` table migration; (2) extend the scoring engine with hysteresis state + threshold detector (guarded so M1 behavior is preserved if detection is disabled); (3) add the SSE + incident endpoints and extend the country endpoint; (4) add the right-panel router, drill-down, feed, modal, and SSE client to the frontend. Rollback: disable the detector and SSE route; the M1 polled globe still works. No destructive schema change to M1 tables.

## Open Questions

- Default threshold set for M2 — which metrics get detectors first? (Lean: markets vol/drawdown, CPI, bilateral tone — matching the design handoff sample incidents.)
- Should resolved incidents age out of the default feed after a window, or persist until archived? (Lean: keep ongoing + last-24h resolved in the default view.)
- Sparkline window length per metric — fixed 30 points, or per-metric by cadence? (Lean: per-cadence so daily and 5-min metrics both read well.)
