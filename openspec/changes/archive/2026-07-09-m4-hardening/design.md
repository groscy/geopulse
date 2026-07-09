## Context

M1–M3 built a functionally complete v1. M4 is about durability, not features: proving the graceful-degradation promise that the whole "staleness, not errors" philosophy rests on, bounding storage growth per ADR-001, tuning hysteresis against real history so the map is trustworthy over weeks, and making the stack runnable on both a constrained host and a full workstation. Nothing user-facing is added; the risk is regressions, so most of this milestone is harnesses and policies.

## Goals / Non-Goals

**Goals:**
- Prove NFR-3: under injected quota/upstream faults, every worker degrades to stale-flag and stays within provider quotas.
- Implement ADR-001's storage story: continuous aggregates for hot reads + 90-day retention on raw high-frequency data.
- Tune NFR-4: measure and reduce flap rate against a 90-day backfill, commit the defaults, and guard against regressions.
- Ship `lite` vs `full` Compose profiles preserving the local-first invariant.

**Non-Goals:**
- New features, sources, or overlays. Conflict source and additional overlays remain v2.
- Cloud deployment, autoscaling, multi-host — contradicts NFR-1.
- Changing the scoring model itself (only its stability parameters and the storage under it).

## Decisions

- **Fault injection at the provider-client seam, not the network.** Each worker's provider client gets a testable seam that can be told to raise quota-exhausted / timeout / malformed. Rationale: deterministic, fast, no reliance on real upstream flakiness; exercises exactly the degradation code path. Alternative (a network proxy like toxiproxy) considered — heavier and less deterministic for asserting write behavior; keep it as an optional integration layer.
- **Continuous aggregates for baselines, raw kept 90d then dropped.** The scorer's per-country rolling stats are the hottest repeated read, so they become continuous aggregates; raw high-frequency observations are retained 90 days (the baseline window) then dropped, while aggregates and slow structural metrics persist. Rationale: bounds growth while preserving everything scoring and the UI actually need. Alternative (keep all raw forever) rejected on NFR-1 host limits.
- **Deterministic replay for tuning.** Backfill + replay must be deterministic (fixed input, no wall-clock/random in scoring) so flap-rate measurements are comparable across parameter sets and usable as a regression guard. Rationale: tuning is only meaningful if repeatable; this also hardens the engine against hidden nondeterminism.
- **Tune, don't redesign, hysteresis.** M4 adjusts N / enter / recover from measured flap rate; it does not replace the hold-count model. Rationale: the explicit model is explainable on the methodology page; keep it, just pick good numbers.
- **Profiles via Compose `profiles:` tags, one compose file.** `lite` and `full` are service tags in one `docker-compose.yml`, not separate files. Rationale: avoids drift between two compose files; the difference is purely which workers start.

## Risks / Trade-offs

- **Retention could drop data a baseline still needs.** → Retain exactly the 90-day baseline window for high-frequency metrics; verify the scorer never asks for older raw data (it reads aggregates for anything longer).
- **Continuous aggregate refresh lag vs live scoring.** → Set refresh policy tighter than the scoring interval for hot aggregates; fall back to raw for the most recent, uncovered window.
- **Over-tuned hysteresis masks real events.** → The tuning objective explicitly includes "known sustained events still register"; the regression guard checks both flap rate AND event retention.
- **Chaos harness diverging from real failure modes.** → Base injected faults on the actual provider error contracts seen in M1–M3; optionally layer a real network-fault proxy for integration runs.
- **Lite profile scoring thin.** → Lite intentionally scores from fewer sources; the UI already renders reduced coverage as stale honestly, so this is acceptable and documented.

## Migration Plan

Additive and reversible. Steps: (1) add the provider-client fault-injection seam + chaos tests; (2) add continuous-aggregate and retention migrations; point the scorer's baseline reads at aggregates; (3) add the backfill/replay mode, measure flap rate, tune + commit parameters, add the regression check; (4) tag services with `lite`/`full` profiles and document them. Rollback: retention/aggregate migrations are additive (can be disabled); profiles default to full; tuning parameters revert to M2 defaults.

## Open Questions

- Exact per-provider quota numbers and the token-bucket parameters that satisfy them (needs each provider's current published limits).
- Which rollups become continuous aggregates beyond the baseline stats (incident feed queries too)?
- Acceptable flap-rate threshold for the regression guard — pick from the measured backfill distribution.
- Should `lite` include FX (cheap, high value) or truly minimal (markets + GDELT only)? (Lean: markets + GDELT + FX.)
