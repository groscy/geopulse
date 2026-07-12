## ADDED Requirements

### Requirement: Storm incidents
The engine SHALL open a `country:storm` incident for each tracked country threatened by an active tropical cyclone, with severity derived from the storm's Saffir-Simpson category (higher categories map to `disrupted`, weaker systems to `degraded`), reusing the existing incident schema, dedup, and resolution lifecycle. The incident `detail` SHALL carry the storm's name, category, and position. When a country is threatened by more than one active storm, the incident SHALL reflect the most severe. A `country:storm` incident SHALL be resolved when no active storm threatens that country (the storm dissipated or moved beyond the resolve-distance threshold). Storm incidents SHALL be produced independently of the worst-of composite membership, exactly as the weather-facet incidents are.

#### Scenario: Active storm opens a storm incident
- **WHEN** an active cyclone threatens a tracked country at or above the severity floor
- **THEN** exactly one `country:storm` incident is opened, titled for the storm and country, with the storm name/category/position in `detail`, without duplicating an already-open one

#### Scenario: Severity follows category
- **WHEN** a threatening storm is a major hurricane (high category) versus a weak tropical system
- **THEN** the storm incident's severity is `disrupted` for the major system and `degraded` for the weak one

#### Scenario: Storm incident resolves when the threat clears
- **WHEN** no active storm threatens a country any longer (dissipated or departed beyond the resolve distance)
- **THEN** that country's `country:storm` incident `resolved_at` is set

#### Scenario: Composite unaffected by storm incidents
- **WHEN** a `country:storm` incident is open while the country's scored domains are operational
- **THEN** the country's composite state is unchanged, because storms are not a scored domain
