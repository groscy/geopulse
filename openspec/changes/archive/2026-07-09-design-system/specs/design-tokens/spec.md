## ADDED Requirements

### Requirement: Surface color palette
The UI SHALL use the graphite surface palette as CSS custom properties: `--bg #0e1116`, `--panel #141a21`, `--panel2 #10161c`, `--card #161d25`, `--line #242c36`, `--line2 #1a212a`, `--txt #c8d1db`, `--txt2 #8a949f`, `--txt3 #5b646f`, and `--em #3f9d6b` (emerald accent). Neutral land is `#1c242e`, dimmed land `#151d26`, and the ocean is a radial gradient `#131c26 → #0a0f15`.

#### Scenario: Tokens applied as variables
- **WHEN** any surface (panel, card, rail, top bar) is styled
- **THEN** it references these tokens as CSS variables rather than hard-coded literals, so the palette is changeable in one place

### Requirement: Health-state semantics
The four health states SHALL use fixed colors everywhere they appear: Operational `#3f9d6b` (equal to `--em`), Degraded `#d3a03f`, Disrupted `#cc5b52`, and Stale `#6b7480`. Stale SHALL additionally be rendered as a 45° diagonal hatch `repeating-linear-gradient(45deg, #5b646f 0 2px, transparent 2px 4px)` on the map and in legends, and SHALL NEVER be shown as a solid health color.

#### Scenario: Consistent state color
- **WHEN** a state color is needed on the globe, a chip, a dot, a badge, or a legend
- **THEN** it uses the corresponding fixed hex, and stale uses the hatch, so state reads identically across the app

#### Scenario: Stale is visually distinct
- **WHEN** a stale value is displayed
- **THEN** it renders with the grey diagonal hatch, clearly distinct from operational green

### Requirement: Data scales
The UI SHALL define the handoff data scales: the relation tone scale `hostile #cc5b52 → tense/amber #d3a03f → warm #3f9d6b`; the temperature scale with stops `−10°C #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`; and the industry/traffic accents cyan `#4aa8c9` (nodes), chain gradient `#c9974a` (raw) → `#3f9d6b` (finished), satellite dots `#eaf4fb`, flight paths `rgba(176,200,224,·)`.

#### Scenario: Tone gradient
- **WHEN** a relation tone bar or arc is colored
- **THEN** it interpolates along the hostile→tense→warm scale

#### Scenario: Temperature choropleth
- **WHEN** the weather overlay colors land by temperature
- **THEN** it maps values along the six-stop temperature scale

### Requirement: Typography system
The UI SHALL use IBM Plex Sans (weights 400/500/600/700) for labels and UI text, and IBM Plex Mono (400/500/600) for ALL numeric/metric values, timestamps, and codes. Base body size SHALL be 13px; section labels 9.5–10px uppercase with letter-spacing .11em in `--txt3`; the top-bar product name 14px/700; the clock 13px mono.

#### Scenario: Numerals are mono
- **WHEN** any metric value, delta, count, or timestamp is rendered
- **THEN** it uses IBM Plex Mono, while surrounding labels use IBM Plex Sans

### Requirement: Spacing, radius, and shadow
The UI SHALL apply the handoff spacing/radius/shadow scale: rail buttons 46px tall × 72px wide; panels padded 12–16px; card radius 8–9px; chips/buttons radius 6–7px; modal radius 14px; card shadow `0 1px 3px rgba(0,0,0,.06)`; modal shadow `0 30px 80px rgba(0,0,0,.6)`; popup shadow `0 16px 40px rgba(0,0,0,.55)`; the legend uses `backdrop-filter: blur(6px)`.

#### Scenario: Card and modal elevation
- **WHEN** a feed card, the incident modal, and the country popup render
- **THEN** each uses its specified radius and shadow from this scale
