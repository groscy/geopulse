## ADDED Requirements

### Requirement: Five orbital shells
The Satellites overlay SHALL render five orbital shells as lifted rings above the sphere (altitude factor ~1.08–1.36): LEO 53° · broadband (~550 km, 16 sats), Polar · Earth imaging (~700 km, 11), LEO 28° · crewed band (~420 km, 13), MEO 65° · navigation (~20 200 km, 9), and GEO · comms & weather (35 786 km, 6) — 55 satellites total. Ring dot colors follow the handoff (cool blues for LEO/MEO, warm for GEO); satellite dots are light `#eaf4fb`.

#### Scenario: Shells render
- **WHEN** the Satellites overlay is on
- **THEN** five orbital rings render at their altitude factors with their satellite counts summing to 55

### Requirement: Orbit occlusion and motion
Orbital rings and satellite dots SHALL be hidden only where the planet actually covers them (visible on the far hemisphere only when their lifted screen position is outside the silhouette radius R), and satellites SHALL move along their orbits per shell speed, respecting `reduceMotion`.

#### Scenario: Ring over the limb stays visible
- **WHEN** part of an orbital ring lifts outside the globe silhouette while its ground track is on the far side
- **THEN** that portion remains drawn, and only the portion the planet occludes is hidden

#### Scenario: Satellites orbit
- **WHEN** the overlay is on and `reduceMotion` is off
- **THEN** satellite dots advance along their rings; when `reduceMotion` is on, they hold static

### Requirement: Constellations panel
The right panel SHALL list the five constellations with their band description, altitude, and satellite count, plus the total (55).

#### Scenario: Constellations listed
- **WHEN** the Satellites overlay panel shows
- **THEN** it lists the five shells with altitude + count and the 55 total
