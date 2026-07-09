## ADDED Requirements

### Requirement: Fixed layout skeleton
The app root SHALL be `height:100vh; display:flex; flex-direction:column; overflow:hidden; background:var(--bg)`, with a fixed 46px top bar, and a body region below it (`flex:1; display:flex; min-height:0`) laid out left-to-right as: left rail 72px, globe stage `flex:1`, right panel 380px. Horizontal page scroll SHALL never occur.

#### Scenario: Three-column body
- **WHEN** the dashboard renders at 1440×900 or larger
- **THEN** the 72px rail, flexible globe stage, and 380px right panel fill the body below the 46px top bar with no page-level scroll

### Requirement: Three top-level views
The app SHALL model three top-level views: the **dashboard** (rail + globe + panel), the **methodology page** (replaces the body region, top bar retained, scrollable reading document), and the **incident modal** (a fixed full-screen overlay above everything). Switching to methodology and back SHALL preserve the dashboard state.

#### Scenario: Methodology replaces body
- **WHEN** the methodology view is opened
- **THEN** the body region is replaced by the scrollable methodology document while the top bar stays, and closing it restores the dashboard

#### Scenario: Modal overlays everything
- **WHEN** the incident modal is open
- **THEN** it renders as a fixed overlay above the dashboard/methodology, which remains mounted beneath it

### Requirement: Top-bar structure
The top bar SHALL contain: left — the emerald logo mark + "GeoPulse" (14/700) + "planetary status" tag (clicking returns home); center — global summary counts (operational/degraded/disrupted/stale), each a colored dot + mono number + label with thin `--line` separators; right — a pulsing-emerald freshness indicator ("Live · updated Ns ago", mono) and a UTC clock `HH:MM:SS` + "UTC" label.

#### Scenario: Top-bar regions
- **WHEN** the top bar renders
- **THEN** it shows the logo/title on the left, the four summary counts in the center, and the freshness indicator + UTC clock on the right

### Requirement: Left-rail structure
The left rail SHALL be organized top→bottom as: a Search toggle; a "Health" group of single-select radio items (Composite, Economy, Markets, Conflict); an "Overlays" group of independent toggles (Relations, Industries, Air traffic, Satellites, Meteorological, Day/night); and pinned at the bottom, Methodology (book) and Settings (sliders). The active indicator SHALL be a 3px emerald bar on the button's left edge plus icon brightening (idle `#6b747f`, hover `#cbd3db`, active `#e4ebf1`).

#### Scenario: Health is single-select, overlays are independent
- **WHEN** the user activates a Health item and toggles Overlay items
- **THEN** exactly one Health item is active at a time while any number of Overlay items may be active simultaneously, each showing the emerald edge-bar when on

### Requirement: Right-panel focus rule
When no country is selected, the right panel SHALL show the most-recently-toggled-on overlay's own panel; turning that overlay off SHALL fall back to the incident feed. Relations and the Health metrics SHALL use the incident feed as their panel. When a country is selected, the panel SHALL show its drill-down regardless of overlays.

#### Scenario: Focus follows the last overlay
- **WHEN** an overlay with its own panel is toggled on while nothing is selected
- **THEN** the right panel switches to that overlay's panel, reverting to the feed when it is toggled off
