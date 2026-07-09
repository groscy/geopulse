## ADDED Requirements

### Requirement: Token buckets keep providers within quota
Each worker SHALL enforce a per-provider token-bucket limiter parameterized to the provider's published quota, such that under sustained load the worker never exceeds that quota within the quota window.

#### Scenario: Sustained load stays in quota
- **WHEN** a worker is driven to fetch continuously against a provider with a known quota
- **THEN** the number of upstream requests in any quota window does not exceed the configured limit

### Requirement: Graceful degradation under fault injection
The system SHALL provide a fault-injection harness that can simulate, per provider, (a) quota exhaustion, (b) upstream timeout/5xx, and (c) malformed/partial responses; and every worker SHALL respond by skipping the cycle and keeping the last-known observation — never crashing, never writing a bad value, and letting affected scores fall to stale.

#### Scenario: Quota exhaustion injected
- **WHEN** the harness forces a provider's bucket empty
- **THEN** the worker defers, logs, and continues; downstream scores for the affected metrics age toward stale rather than erroring

#### Scenario: Malformed response injected
- **WHEN** the harness returns a malformed payload
- **THEN** the worker rejects it, writes no observation for that fetch, and does not crash

#### Scenario: Recovery
- **WHEN** the injected fault is cleared
- **THEN** the worker resumes normal fetching and the affected scores recover from stale on the next cycles

### Requirement: Degradation is stale-flag, not error surface
A source degradation SHALL surface to the user as staleness (hatch / source·age), consistent with the staleness indicators, and SHALL NOT surface as an application error or a silently-current value.

#### Scenario: User sees staleness, not an error
- **WHEN** a source is down for a country's metric
- **THEN** that metric renders stale with its age, and no error state is shown to the user
