## 1. Fault-injection seam

- [x] 1.1 Add a testable seam at each worker's provider-client boundary that can inject quota-exhausted, timeout/5xx, and malformed responses.
- [x] 1.2 Ensure injection is config/test-only and off in normal operation.

## 2. Rate-limit & chaos tests

- [x] 2.1 Finalize per-provider token-bucket parameters against each provider's published quota.
- [x] 2.2 Test: sustained load never exceeds quota within the quota window.
- [x] 2.3 Test: injected quota exhaustion → worker defers, keeps last-known, does not crash; affected scores age to stale.
- [x] 2.4 Test: injected timeout and malformed response → no bad write, no crash; recovery restores normal fetching.
- [x] 2.5 Confirm degradation surfaces as staleness in the UI, never as an application error.

## 3. Continuous aggregates & retention

- [x] 3.1 Migration: continuous aggregate(s) for per-country per-metric rolling baseline stats; set a refresh policy tighter than the scoring interval.
- [x] 3.2 Point the scoring engine's baseline reads at the aggregate; fall back to raw for the most-recent uncovered window.
- [x] 3.3 Migration: retention policy dropping high-frequency raw observations past 90 days; preserve aggregates and slow structural metrics.
- [x] 3.4 Verify fresh bring-up creates aggregates + policies from migrations; verify old raw is dropped and structural data retained.

## 4. Backfill replay & hysteresis tuning

- [x] 4.1 Add a deterministic backfill loader (90 days) and a scoring replay mode (no wall-clock/random in scoring).
- [x] 4.2 Implement flap-rate measurement (transitions per country per unit time) over the replay.
- [x] 4.3 Tune N / enter / recover to minimize flap rate while preserving known sustained events; commit chosen defaults to config.
- [x] 4.4 Add a regression check asserting flap rate stays under the accepted threshold AND sustained events still transition.

## 5. Compose profiles

- [x] 5.1 Tag services with `lite` (db + markets + gdelt [+ fx] + scoring + api + frontend) and `full` (all workers) profiles in `docker-compose.yml`.
- [x] 5.2 Verify `lite` and `full` each start exactly their service set and the globe renders under each.
- [x] 5.3 Confirm both profiles keep the local-first invariant (egress only to public data providers).
- [x] 5.4 Document profiles in README / `.env.example`: sources included and host resources expected.

## 6. Verification

- [x] 6.1 Run the full chaos suite; confirm every worker degrades gracefully and stays within quota.
- [x] 6.2 Confirm storage stays bounded over a simulated >90-day run (raw dropped, aggregates intact).
- [x] 6.3 Confirm the tuned hysteresis defaults are committed and the stability regression check passes.
- [x] 6.4 Confirm a clean `docker compose --profile lite up` and `--profile full up` both come up healthy.
