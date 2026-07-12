## ADDED Requirements

### Requirement: Storm worker
A `storm-worker` SHALL, on its own slow cadence, fetch the currently-active tropical cyclones from a keyless source (NOAA NHC `CurrentStorms.json`, Atlantic + East Pacific) and cache them as a single blob, overwriting it each cycle. For each active storm it SHALL capture a stable id, name, basin, current position (lat/lon), Saffir-Simpson category / intensity, and the forecast track points, tagged with a fetch timestamp. The worker SHALL require no API key, respect a per-provider token bucket, and degrade gracefully — on quota exhaustion or upstream error it SHALL skip the cycle and leave the last-known storm set in place rather than crashing.

#### Scenario: Active storms cached
- **WHEN** the storm-worker runs a cycle and the source returns active cyclones
- **THEN** it writes a single blob listing each active storm with id, name, basin, position, category, and forecast track, with a fetch timestamp

#### Scenario: No active storms
- **WHEN** the source reports no active cyclones
- **THEN** the worker caches an empty active-storm set (and resolves any open storm incidents), without error

#### Scenario: Provider failure is non-fatal
- **WHEN** the NHC feed is unavailable or the token bucket is empty
- **THEN** the worker skips the cycle, logs the deferral, and leaves the last cached storm set in place without crashing

### Requirement: Storm data isolated from the scoring spine
Storm data SHALL be feature data with **no per-country z-score and no state**. It SHALL NOT be written to the `observation` store, SHALL NOT be rolled into a scored domain, and SHALL NOT affect the worst-of composite. Its storage SHALL be isolated from `observation` and `score`, so adding or removing storms leaves the scoring pipeline unchanged. Storms MAY open incidents (see incident-detection) via the shared incident schema.

#### Scenario: Storms never enter scoring
- **WHEN** storms are fetched and cached
- **THEN** no `observation` or `score` row is created from them, and per-country scoring is unaffected by their presence

### Requirement: Storm to country mapping
The worker SHALL map each active storm to the tracked country/countries it threatens, based on the proximity of the storm's current position and near-term forecast points to each country's representative point. A storm SHALL be considered to threaten a country when it is within a configured open-distance threshold, and to have cleared it only beyond a larger resolve-distance threshold (a spatial buffer that prevents flapping as the storm skirts the boundary).

#### Scenario: Nearby storm threatens a country
- **WHEN** an active storm's position (or near-term track) is within the open-distance threshold of a tracked country
- **THEN** that country is marked as threatened by that storm (eligible for a storm incident)

#### Scenario: Departing storm clears a country
- **WHEN** a storm that threatened a country moves beyond the larger resolve-distance threshold
- **THEN** that country is no longer marked as threatened, and its storm incident becomes eligible for resolution
