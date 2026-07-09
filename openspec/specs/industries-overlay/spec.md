# industries-overlay Specification

## Purpose
TBD - created by archiving change extended-overlays. Update Purpose after archive.
## Requirements
### Requirement: Five curated industries
The Industries overlay SHALL provide five curated industries — Semiconductors ("Leading-edge logic & memory"), EV batteries ("Lithium-ion cells & packs"), Pharmaceuticals ("Small-molecule drugs & APIs"), Oil & gas ("Crude, refining & petrochem"), and Coffee ("Green bean to retail cup") — selectable from the right panel, each with its curated Key-players and Supply-chain data transcribed verbatim from the reference.

#### Scenario: Select an industry
- **WHEN** the user selects an industry chip in the panel
- **THEN** the globe and panel update to that industry's players/chain data, with exactly one industry active

### Requirement: Key players sub-mode
In Key-players mode, each key country SHALL render a sized ranked node (radius ∝ value share) filled cyan `#4aa8c9` with a soft halo, ring, and centered mono rank number; the right panel SHALL list the players sorted by share with value-share bars. For example Semiconductors players are Taiwan 0.68, South Korea 0.19, China 0.16, United States 0.12, Japan 0.10.

#### Scenario: Ranked player nodes
- **WHEN** Key-players mode is active for Semiconductors
- **THEN** Taiwan renders the largest node and the panel lists players in descending share order with bars

### Requirement: Supply chain sub-mode
In Supply-chain mode, the overlay SHALL render numbered stage nodes colored along the chain gradient raw `#c9974a` → finished `#3f9d6b`, connected by an arched route with flow particles moving extraction → market; the right panel SHALL show the vertical numbered stage list. For example Semiconductors chain is Australia (Extraction) → Japan (Materials) → Taiwan (Fabrication) → China (Assembly) → United States (Market).

#### Scenario: Supply-chain route
- **WHEN** Supply-chain mode is active for Semiconductors
- **THEN** the five stages render in order along an arched route with particles flowing toward the market stage

### Requirement: Industries pauses auto-rotation and uses its own panel
While the Industries overlay is on, globe idle auto-rotation SHALL pause, and the right panel (when no country is selected) SHALL show the industry selector chips, the Key players / Supply chain sub-tab toggle, and the ranked-players or stage list per the focus rule.

#### Scenario: Rotation pauses
- **WHEN** the Industries overlay is toggled on
- **THEN** the globe stops idle rotation and the right panel shows the industries panel

