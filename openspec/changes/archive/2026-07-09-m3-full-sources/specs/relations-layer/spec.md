## ADDED Requirements

### Requirement: Tone-colored relation arcs
The globe SHALL render bilateral relation arcs between country pairs, colored by GDELT tone on a hostile `#cc5b52` → tense `#d3a03f` → warm `#3f9d6b` scale, using a great-circle path that is arched (each point lifted radially by `1 + h·sin(π·f)`, longer links arch higher).

#### Scenario: Arc colored by tone
- **WHEN** the US↔CN relation has tone z −1.4
- **THEN** an arc is drawn between them in the tense/amber portion of the tone scale

### Requirement: Correct occlusion
An arc point SHALL be hidden only when its ground track is on the far hemisphere AND its lifted screen position falls within the globe silhouette radius R — so arcs that rise above the limb stay visible and only what the planet actually covers is clipped.

#### Scenario: Arc over the limb stays visible
- **WHEN** part of an arc lifts above the globe's silhouette while its ground track is on the far side
- **THEN** that portion remains drawn, and only the portion the planet occludes is hidden

### Requirement: Directional flow particles
Arcs SHALL carry flow particles animating toward the net importer (or the design-defined direction), following the same arch + occlusion rules and fading in/out with `sin(π·phase)`. Particles SHALL respect the `reduceMotion` flag.

#### Scenario: Flow direction
- **WHEN** relations arcs are shown between two countries
- **THEN** particles move along the arc in the defined direction and pause when `reduceMotion` is set

### Requirement: Relations scope by selection
When the Relations overlay is ON, all bilateral arcs SHALL be shown; when it is OFF but a country is selected, only that country's arcs SHALL be shown.

#### Scenario: Selected-only arcs
- **WHEN** Relations overlay is off and Japan is selected
- **THEN** only Japan's relation arcs render
