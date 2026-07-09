## Why

By the end of M3 GeoPulse is functionally complete for v1, but it has not been proven under stress, its storage grows unbounded, its hysteresis is untuned against real history, and it ships as one heavy all-or-nothing stack. Milestone M4 hardens the system for sustained local operation: it proves graceful degradation under provider failure and quota pressure (NFR-3), enforces the 90-day retention and continuous-aggregate story (ADR-001), tunes score stability against a 90-day backfill (NFR-4), and adds Compose profiles so the stack can run "lite" or "full" (M4 scope).

This change delivers M4 and closes out NFR-3 (rate-limit resilience), NFR-4 (score stability), and the storage/retention half of NFR-1/ADR-001.

## What Changes

- **Rate-limit chaos testing**: exercise workers against injected quota exhaustion, upstream timeouts, and malformed responses; assert every source degrades to stale-flag (never fatal error, never a bad write), and that token buckets hold providers within quota.
- **Continuous aggregates + retention**: add TimescaleDB continuous aggregates for the rollups the scorer/UI read repeatedly, and retention policies that drop high-frequency raw observations past 90 days while preserving aggregates and structural metrics.
- **Hysteresis tuning against backfill**: load a 90-day backfill, replay scoring, measure flap rate, and tune N / enter / recover so states are stable without masking genuine events; capture the chosen defaults.
- **Compose profiles**: `lite` (db + one or two workers + scoring + api + frontend) vs `full` (all workers) so the stack can run on constrained hosts or a full workstation.

## Capabilities

### New Capabilities
- `rate-limit-resilience`: the fault-injection / chaos harness and the assertions that every worker degrades gracefully and stays within provider quotas.
- `data-retention`: TimescaleDB continuous aggregates and retention policies implementing the 90-day story with preserved rollups.
- `score-stability`: the backfill-driven hysteresis tuning harness, flap-rate measurement, and the committed default parameters.
- `deployment-profiles`: Docker Compose `lite` vs `full` profiles for constrained vs full-capability hosts.

### Modified Capabilities
<!-- None as deltas: prior-milestone specs are not yet archived. M4 hardens the existing store, workers, and scoring at implementation time. -->

## Impact

- **observation store**: gains continuous aggregate materialized views and retention policies; the scorer/UI read from aggregates where cheaper.
- **workers**: gain a testable fault-injection seam; token-bucket parameters finalized per provider quota.
- **scoring-engine**: hysteresis defaults (N, enter, recover) finalized from measured flap rates; a replay/backfill mode added for tuning.
- **docker-compose**: split into profiles; `.env`/profile docs updated.
- **Out of scope**: new features or data sources; the Conflict source and additional overlays remain v2.

## Depends On
- m3-full-sources
