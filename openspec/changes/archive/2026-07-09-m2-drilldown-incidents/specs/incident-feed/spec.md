## ADDED Requirements

### Requirement: Global incident feed
When no country is selected, the right panel SHALL show a global chronological incident feed with a header count of active incidents and filter chips All / Ongoing / Resolved. Each incident renders as a card with a severity dot (state color), title, affected-country flag(s), the triggering metric (mono, e.g. "1d realized vol · z +2.1"), a "since HH:MM UTC" footer, and a status badge (Ongoing / Resolved).

#### Scenario: Feed lists incidents newest-first
- **WHEN** the feed loads with several incidents
- **THEN** they are listed most-recent-first with severity color, metric, and since-time

#### Scenario: Filter to ongoing
- **WHEN** the user selects the "Ongoing" filter chip
- **THEN** only unresolved incidents are shown

### Requirement: Feed card selects country
Clicking an incident card (outside its chart icon) SHALL select that incident's country and open its drill-down.

#### Scenario: Card click drills down
- **WHEN** the user clicks an incident card for Argentina
- **THEN** the panel switches to Argentina's drill-down

### Requirement: Incident detail modal
An incident with a chart SHALL open a fixed, centered detail modal showing: severity dot, title, status badge, a sub-line with detection time and hysteresis note, and an SVG line chart of the triggering series with a dashed threshold line labeled with its z level, a breach marker where the series crosses, and axis ticks; below the chart, stat cards for current z-score, 90d baseline μ±σ, and affected country, plus an explanatory paragraph. The modal closes on backdrop click or ✕.

#### Scenario: Open threshold chart
- **WHEN** the chart icon on the USD/JPY volatility incident is clicked
- **THEN** the modal opens with the series, the dashed "degraded threshold · z +1.5" line, and a breach marker at the crossing

#### Scenario: Close modal
- **WHEN** the backdrop or ✕ is clicked
- **THEN** the modal closes and the previous panel state is restored

### Requirement: Live feed updates
The feed SHALL update from the live stream — new incidents animate in and resolved incidents update their badge — without a manual refresh.

#### Scenario: New incident appears live
- **WHEN** an `incident` opened event arrives on the stream
- **THEN** a new card animates into the feed and the active count increments
