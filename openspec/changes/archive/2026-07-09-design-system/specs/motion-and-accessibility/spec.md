## ADDED Requirements

### Requirement: Motion inventory and timings
Motion SHALL be minimal and never bouncy, matching the handoff: globe idle rotation ~0.05°/frame (pausing when a country is selected or the Industries overlay is on); arc flow particles animate along connections and arcs pulse opacity gently (`0.72 + 0.28·sin`); storm spirals rotate slowly and satellites orbit; incident cards enter with `gp-slide` (translateY 7px + fade, .3s); the modal animates with `gp-modal` (.22s cubic-bezier(.2,.7,.3,1)).

#### Scenario: Idle rotation pauses on interaction
- **WHEN** a country is selected or the Industries overlay is on
- **THEN** the globe's idle auto-rotation pauses

#### Scenario: Card and modal transitions
- **WHEN** an incident card appears or the modal opens
- **THEN** the card uses the `gp-slide` transition and the modal uses the `gp-modal` transition at the specified durations

### Requirement: reduceMotion contract
A `reduceMotion` flag SHALL, when enabled, disable idle rotation, flow particles, arc/opacity pulsing, and node pulsing, while keeping all information legible and interactions functional.

#### Scenario: Reduced motion
- **WHEN** `reduceMotion` is enabled
- **THEN** rotation, flow particles, and pulsing stop, and the globe and panels remain fully usable and readable

### Requirement: Tweakable accent
An `accent` color prop SHALL drive `--em`, the operational state color, and the "warm" end of the relation tone scale together, so re-theming the accent keeps operational/warm consistent with the emerald identity.

#### Scenario: Accent re-theme
- **WHEN** the `accent` prop is changed
- **THEN** `--em`, the operational color, and the warm tone endpoint all update to the new accent

### Requirement: Component state model
The dashboard SHALL be driven by a single component state comprising at least: `domain` (composite|economy|markets|conflict), `overlays{relations,industry,air,sat,weather,sun}`, `focus` (feed|overlay id), `selected` (country|null), `modal` (incident id|null), `industry` + `indView` (players|chain), `feedFilter` (all|ongoing|resolved), `searchOpen`/`searchQ`, and `now`/`freshAgo` (updated by a 1s interval). Imperative globe state (`lambda`, `phi`, the rAF loop) SHALL live outside React state.

#### Scenario: Single source of truth
- **WHEN** any control changes (health metric, overlay, selection, filter, search)
- **THEN** the change is reflected in this state object and the UI derives from it, while the globe rotation is driven imperatively by `lambda`/`phi`
