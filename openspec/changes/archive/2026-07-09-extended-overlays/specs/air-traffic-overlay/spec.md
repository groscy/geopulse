## ADDED Requirements

### Requirement: Hub-to-hub flight paths
The Air-traffic overlay SHALL render approximately 34 great-circle flight paths between 28 curated global hub airports (e.g. NYC, LHR, CDG, FRA, DXB, DOH, SIN, HKG, PEK, PVG, NRT, ICN, LAX, SFO, GRU, JNB, SYD), drawn as faint lines `rgba(176,200,224,·)` following the same arch + occlusion rules as relation arcs.

#### Scenario: Flight network renders
- **WHEN** the Air-traffic overlay is on
- **THEN** ~34 arched flight paths render between the curated hubs, correctly occluded by the globe

### Requirement: Moving plane particles
Each flight path SHALL carry a moving "plane" particle (light `#e2ecf6`/`#eaf4fb`) animating along the arc, respecting the `reduceMotion` flag.

#### Scenario: Planes animate
- **WHEN** the overlay is on and `reduceMotion` is off
- **THEN** particles move along each flight path; when `reduceMotion` is on, they hold static

### Requirement: Busiest corridors panel
The right panel SHALL list the busiest corridors — Transatlantic (NYC · LHR · CDG), Gulf super-hub (DXB · DOH · SIN), Transpacific (LAX · NRT · ICN), Kangaroo route (AMS · SIN · SYD), Intra-Asia (HKG · BKK · PEK) — and the total active route count.

#### Scenario: Corridors listed
- **WHEN** the Air-traffic overlay panel shows
- **THEN** it lists the five named corridors and the count of active routes
