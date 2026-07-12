## ADDED Requirements

### Requirement: Finer packed field grid
The atmospheric field MAY be sampled on a **finer grid** (a smaller step than the coarse default) for greater spatial detail, and the cached grid SHALL be serializable in a **packed columnar** form — grid dimensions (latitude/longitude extent, step, counts) plus flat per-channel arrays (`cloud`, `u`, `v`, `precip`) — from which node positions are reconstructed, rather than only an array of per-node objects. The packed form SHALL carry the same information as the per-node form and SHALL be the default at fine resolution so the payload and decode stay cheap. The worker SHALL still fetch the finer grid in batched keyless requests on the slow cadence and cache one blob, unchanged in isolation from the scoring spine.

#### Scenario: Finer grid fetched and cached
- **WHEN** the field worker runs with a finer step
- **THEN** it fetches the denser grid in batched requests and caches one blob, still isolated from `observation`/`score`

#### Scenario: Packed columnar form is equivalent
- **WHEN** the field is serialized in the packed columnar form
- **THEN** the client reconstructs the same per-node cloud/wind/precip field it would from the per-node form, at lower payload and decode cost
