## ADDED Requirements

### Requirement: Health metric single-select
The left rail SHALL provide a single-select Health metric group — Composite, Economy, Markets, Conflict — where exactly one is active at a time, and the active metric SHALL determine which domain colors a *selected* country on the globe.

#### Scenario: Switch health metric
- **WHEN** the user selects "Economy" in the rail with a country selected
- **THEN** that country is colored by its Economy domain state, and only one Health metric shows active

### Requirement: Independent overlay toggles
The left rail SHALL provide overlay toggles (M3: Relations) that are independent booleans and may be on simultaneously, each rendering on the same globe without replacing the others.

#### Scenario: Overlay stacks
- **WHEN** the Relations overlay is toggled on
- **THEN** its arcs render on top of the existing globe without turning off the base choropleth, and its active state is indicated on the rail button

### Requirement: Right-panel focus rule
When no country is selected, the right panel SHALL show the most-recently-toggled-on overlay's panel; turning that overlay off SHALL fall back to the incident feed. The Relations overlay and the Health metrics SHALL use the incident feed as their panel.

#### Scenario: Overlay panel focus
- **WHEN** an overlay with its own panel is toggled on while nothing is selected
- **THEN** the right panel switches to that overlay's panel, and reverts to the feed when the overlay is turned off

### Requirement: Active-layer summary
The globe stage SHALL show a top-left chip summarizing the active layers (e.g. "Composite · Relations"), and the bottom-left legend SHALL show one section per active layer, including the health-state key and the relation tone gradient.

#### Scenario: Layer chip reflects state
- **WHEN** Composite health and the Relations overlay are active
- **THEN** the chip reads "Composite · Relations" and the legend shows both the state key and the tone gradient
