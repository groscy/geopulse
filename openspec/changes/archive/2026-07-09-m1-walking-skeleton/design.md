## Context

M1 is the walking skeleton: the thinnest end-to-end slice that exercises every seam of the target architecture (ingest → store → score → serve → render) so later milestones only add breadth, not new plumbing. The architecture, data model, scoring formula, and ADRs are fixed by the kickstart doc; this design records how to realize the M1 subset of them and where we deliberately cut scope.

Current state: greenfield. Empty repo with an `openspec/` planning root, a design handoff bundle (`design_handoff_geopulse/`, including a working reference `GeoPulse.dc.html`), and no application code.

Constraints: local-first (single host, Docker Compose, egress only to public APIs); free-tier API quotas; 60 fps globe on mid-range GPU; every score must be decomposable to raw observations.

## Goals / Non-Goals

**Goals:**
- One `docker compose up` brings the whole stack up on a clean machine and produces a composite-colored globe within one scoring cycle.
- Prove the `Observation` contract: two structurally different sources land in one uniform table the scorer reads without knowing the source.
- Prove auditability early: the `score.inputs` decomposition exists from day one.
- Establish the service boundaries (per-worker container, standalone scorer, read-only API, static frontend) that M2–M4 extend.

**Non-Goals:**
- Incidents, threshold detection, SSE, hysteresis — deferred to M2.
- FX / macro / conflict sources, relations arcs, methodology page — M3.
- Continuous aggregates, retention policies, rate-limit chaos testing, lite/full profiles — M4.
- Drill-down right panel and per-country sparklines — M2.

## Decisions

- **One process per source family, own scheduler.** Each worker is its own container with an in-process scheduler (APScheduler or a simple asyncio loop). Rationale: isolates failure and cadence per source (ADR-aligned with the ingestion diagram); a stuck GDELT fetch cannot delay markets. Alternative considered: a single scheduler dispatching all sources — rejected, it recreates the coupling we are trying to avoid.
- **TimescaleDB from the start (ADR-001).** Even though M1 has no continuous aggregates yet, we create the hypertable now so M4 only adds policies, not a migration of the base table. Alternative (SQLite for the skeleton) rejected — it would force a store rewrite at M4.
- **Static scoring, no hysteresis (scope cut).** M1 computes state from current z-scores with no flap-damping and no incident emission. Rationale: hysteresis and incidents are meaningless without a live update loop, which arrives in M2. The `score` table and `inputs` decomposition are full-fidelity so M2 only adds the transition logic.
- **Read-only REST, polled by the frontend.** M1 frontend polls `GET /api/tiles` on an interval; SSE is deferred to M2 (ADR-004 still governs the eventual live channel). Rationale: polling is trivial and removes a moving part from the skeleton.
- **Canvas 2D + D3-geo orthographic (ADR-002).** Matches the design handoff reference implementation exactly; keep the imperative canvas render loop rather than SVG/DOM. deck.gl is not needed until relation arcs (M3).
- **ISO-3 as the country key everywhere.** Workers normalize to ISO-3 on write; the topojson `countries-110m` names are mapped to ISO-3 via a small lookup so the frontend can join tiles to polygons.

## Risks / Trade-offs

- **Free-tier market API limits may not cover 10 indices at 5 min.** → Start with G20-subset indices and the Stooq EOD fallback; reduced confidence on fallback is surfaced, not hidden.
- **Thin baselines on first run produce mostly `stale`.** → This is correct behavior (ADR-003 warm-up), not a bug; the globe will be largely neutral/hatched until history accumulates. Document it so it does not read as broken.
- **GDELT tone is noisy at dyad level.** → Enforce a minimum event count per window before emitting a tone observation (carried into the `data-ingestion` spec).
- **Topojson name → ISO-3 mismatches** (e.g. disputed/renamed territories) → maintain an explicit override map; unmatched polygons render neutral, never mis-joined.

## Migration Plan

Greenfield, so "migration" = first bring-up. Steps: (1) DB service with init migrations creating the extension + hypertables; (2) workers begin writing observations; (3) scoring-engine runs on its interval once data exists; (4) API serves whatever scores exist; (5) frontend polls and renders. Rollback = `docker compose down -v` (drop the volume); the stack is reproducible from migrations.

## Open Questions

- Which exact 10 indices for M1? (Lean G20 majors: S&P 500, Nikkei 225, CSI 300, DAX, FTSE 100, CAC 40, SMI, Merval, Sensex, S&P/ASX 200.) To be confirmed against provider coverage.
- Scoring interval for M1 — 5 min as per NFR-2, or slower while baselines are thin? Default 5 min; revisit if quotas bite.
- Do we seed a short historical backfill on first run to shorten warm-up, or accept a live warm-up? Leaning accept-live for the skeleton; backfill is an M4 concern.
