# Handoff: GeoPulse — planetary status dashboard

## Overview
GeoPulse is a dark, operations-console web dashboard that presents the world like a
"status page for the planet." A central interactive 3D globe shows every country; a
left rail toggles data layers; a right panel shows either a global incident feed or a
drill-down for a selected country. There is also an incident-detail modal and a
long-form methodology page. Visual language is calm and cartographic — think AWS
Health Dashboard / Grafana / Datadog, not a news site.

Reference target: desktop, 1440×900 and up. Single page app.

## About the Design Files
The file in this bundle (`GeoPulse.dc.html`) is a **design reference created in HTML +
Canvas 2D + D3-geo**. It is a working prototype that shows the intended look and behavior;
it is **not production code to copy directly**. The task is to **recreate this design in
the target codebase's existing environment** (React, Vue, Svelte, etc.) using that
codebase's established patterns, component library, and state tooling. If no environment
exists yet, pick the most appropriate framework and implement there. The globe is drawn
imperatively on a `<canvas>` with D3-geo; keep that approach (or an equivalent WebGL/
globe.gl implementation) — do not attempt to rebuild it in SVG/DOM.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are all defined
below. Recreate pixel-accurately using the codebase's libraries. Exact hex values, px
sizes, and copy are given.

---

## Global layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOP BAR  (height 46px, fixed)                                        │
├───────┬───────────────────────────────────────────────┬─────────────┤
│ LEFT  │                                               │  RIGHT      │
│ RAIL  │            GLOBE STAGE (flex:1)                │  PANEL      │
│ 72px  │            <canvas> fills area                │  380px      │
│       │            + overlays (chip, legend, popup)    │             │
└───────┴───────────────────────────────────────────────┴─────────────┘
```

- Root: `height:100vh; display:flex; flex-direction:column; overflow:hidden; background:#0e1116`.
- Body below top bar: `flex:1; display:flex; min-height:0`.
- The **methodology page** replaces the body region (top bar stays) as a scrollable document.
- The **incident modal** is a fixed full-screen overlay above everything.

---

## Design tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0e1116` | app background (graphite) |
| `--panel` | `#141a21` | right panel, modal surface |
| `--panel2` | `#10161c` | top bar, rail, inset cards |
| `--card` | `#161d25` | incident feed cards |
| `--line` | `#242c36` | primary dividers/borders |
| `--line2` | `#1a212a` | subtle dividers |
| `--txt` | `#c8d1db` | primary text |
| `--txt2` | `#8a949f` | secondary text |
| `--txt3` | `#5b646f` | tertiary/labels |
| `--em` | `#3f9d6b` (tweakable) | emerald accent / interactive / "warm" |
| neutral land | `#1c242e` | country fill when not selected |
| dimmed land | `#151d26` | non-selected countries when one is selected |
| ocean | radial `#131c26`→`#0a0f15` | globe sphere fill |

### State (health) semantics — used everywhere, must stay consistent
| State | Hex | Meaning |
|---|---|---|
| Operational | `#3f9d6b` (= accent) | healthy |
| Degraded | `#d3a03f` | amber |
| Disrupted | `#cc5b52` | red |
| Stale / no data | `#6b7480` + diagonal hatch | insufficient/old data — **must read as distinct from healthy** |

Stale is rendered as a `repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)`
hatch on the map and in legends; never a solid health color.

### Relation tone scale
`hostile #cc5b52` → `tense/amber #d3a03f` → `warm #3f9d6b` (gradient left→right).

### Industry / traffic accent
Cyan `#4aa8c9` (players + node fills), chain gradient `#c9974a` (raw) → `#3f9d6b` (finished),
satellite dots `#eaf4fb`, flight paths `rgba(176,200,224,·)`.

### Temperature scale (weather)
stops: `-10°C #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`.

### Typography
- Label / UI font: **IBM Plex Sans** (400/500/600/700).
- All numeric/metric values, timestamps, codes: **IBM Plex Mono** (400/500/600).
- Base body size 13px. Section labels 9.5–10px uppercase, letter-spacing .11em, `--txt3`.
- Top-bar product name 14px/700; clock 13px mono; slide/section titles 14–17px/600.

### Spacing / radius / shadow
- Rail buttons 46px tall, full width (72px). Panels padded 12–16px.
- Card radius 8–9px; chips/buttons 6–7px; modal 14px.
- Card shadow `0 1px 3px rgba(0,0,0,.06)`; modal `0 30px 80px rgba(0,0,0,.6)`;
  popup `0 16px 40px rgba(0,0,0,.55)`; legend uses `backdrop-filter: blur(6px)`.

### Motion (minimal, never bouncy)
- Globe idle rotation ~0.05°/frame; pauses when a country is selected or Industries overlay is on.
- Arc particles flow along connections; arcs pulse opacity gently (`0.72 + 0.28*sin`).
- Storm spirals rotate slowly; satellites orbit.
- Incident cards `gp-slide` (translateY 7px + fade, .3s). Modal `gp-modal` (.22s cubic-bezier(.2,.7,.3,1)).
- Respect a `reduceMotion` flag: disables rotation, flow particles, pulsing, node pulse.

---

## Screens / Views

### 1. Top bar (always visible)
- Left: emerald square logo mark (22px, rounded 6px, inner glowing dot) + "GeoPulse" (14/700, `#e7eef4`) + "planetary status" tag (`--txt3`). Clicking returns to default (home).
- Center: global summary counts, each = colored dot + mono number + label:
  `142 operational` (green) · `38 degraded` (amber) · `15 disrupted` (red) · `8 stale`
  (hatched swatch). Thin `--line` vertical separators between.
- Right: freshness indicator = pulsing emerald dot + "Live · updated `N`s ago" (N increments
  each second, mono); vertical separator; UTC clock `HH:MM:SS` (13px mono `#e7eef4`) + "UTC" label.

### 2. Left rail (72px, icon buttons, vertically scrollable middle group)
Top → bottom:
- **Search** icon (magnifier) — toggles a country search overlay.
- Group label **"Health"**.
- **Health metric — single-select radio** (only one active): Composite (globe/meridian icon),
  Economy (bar-chart), Markets (line), Conflict (warning triangle). Sets which health domain
  colors a *selected* country.
- Group label **"Overlays"**.
- **Overlay toggles — independent, may all be on at once**: Relations (linked-nodes icon),
  Industries (factory), Air traffic (plane), Satellites (satellite), Meteorological (cloud),
  Day / night (sun-with-rays).
- Bottom (pinned): Methodology (open-book icon), Settings (sliders icon, decorative).

Active indicator: a 3px emerald bar on the left edge of the button + icon brightens to
`#e4ebf1` (idle icon `#6b747f`, hover `#cbd3db`). Radio items show active by current metric;
toggle items show active while their overlay is on.

### 3. Globe stage (center, flex:1)
- Full-bleed `<canvas>`; background `radial-gradient(120% 100% at 50% 46%, #111820, #0d1116 62%, #0b0e13)`.
- **Overlays on top of canvas:**
  - Top-left chip: "Layer" label + active-layers summary string, e.g. `Composite · Relations · Air traffic`.
  - Country search overlay (when search on): 280px card, input + result rows (state dot + name + state).
  - Bottom-left **legend** card (semi-transparent, blurred): title "Legend" then one stacked
    section per active thing — health-state key, relation tone gradient, industry share/chain,
    temperature scale, day/night, traffic note.
  - Bottom-right hint: "drag to rotate · click a country" (mono, `--txt3`).
  - **Country popup** (when a country is selected): small 210px card positioned over the country,
    offset right so it clears the arcs, with a pointer aimed at the country. Shows flag + name +
    state swatch, then a 2×2 grid: GDP, GDP / capita, Happiness (+ rank), Population (mono values).

#### Globe rendering (Canvas 2D via D3-geo orthographic)
- Projection: `d3.geoOrthographic().scale(min(w,h)*0.42).translate([w/2, h*0.5]).clipAngle(90)`,
  rotated by `[lambda, phi]` (phi default −16). Retina-scale the canvas by devicePixelRatio.
- Country polygons from world-atlas `countries-110m` topojson.
- **Atmosphere**: radial gradient ring just outside the sphere (`rgba(72,158,185,·)`), no other gradients.
- **Ocean**: sphere path filled with dark radial gradient. Faint graticule `rgba(255,255,255,0.045)`.
- **Country fill rule** (important — territories are neutral until interacted with):
  - No selection, no Weather overlay → all land neutral `#1c242e` (stale countries → hatch pattern).
  - Weather overlay on → land filled by temperature color (alpha .58).
  - A country is selected → that country filled by the chosen **health domain** color; its
    linked partners filled by their composite color; all others dimmed to `#151d26`.
- **Borders**: mesh stroke `rgba(9,13,17,0.85)`, 0.55px. Selected country gets a white 1.6px
  outline; linked partners get a tone-colored 1.3px outline.
- **Connections (arcs)**: great-circle interpolation, **arched** — each point lifted radially
  from screen center by `1 + h*sin(π·f)` where `h = min(0.34, geoDistance*0.17)` (longer links
  arch higher). **Occlusion**: a point is hidden only when its ground track is on the far
  hemisphere AND its lifted screen position is within the globe silhouette radius `R` — i.e.
  clip only what the planet actually covers; arcs that rise above the limb stay visible.
- **Flow particles**: dots animate along each arc toward the net importer (relations) or toward
  market (supply chain); same arch + occlusion rule; fade in/out with `sin(π·phase)`.
- **Nodes** (industry): filled circle + soft halo + ring + centered mono rank/stage number.
- **Interaction**: drag to rotate (pointer events; updates lambda/phi); click a country
  (`d3.geoContains` on inverted pointer) selects it and recenters the globe to its centroid;
  click ocean deselects.

### 4. Right panel — Global incident feed (default, no selection)
- Header: "Global incidents" + "`N` active" (mono). Filter chips: All / Ongoing / Resolved
  (active chip = emerald border + tint).
- Scrolling list of incident cards (`--card`, radius 9, `gp-slide` in):
  - severity dot (state color + soft glow ring), title (13/600 `#dfe7ee`), optional chart icon
    (only if the incident has a chart — opens modal, stops propagation),
  - row: affected-country flag image(s) + triggering metric (mono, e.g. "1d realized vol · z +2.1"),
  - footer: "since `HH:MM UTC`" (mono) + status badge pill (Ongoing = sev color tint / Resolved = green tint).
- Clicking a card selects that incident's country (opens the drill-down).

Sample incidents (use verbatim):
1. USD/JPY realized volatility elevated — degraded, JP, "1d realized vol · z +2.1", since 09:40 UTC, ongoing, **has chart**.
2. Argentina CPI breach — disrupted, AR, "CPI MoM · z +3.1", since 06:12 UTC, ongoing.
3. Nikkei 225 drawdown — degraded, JP, "Index −2.8% · z −1.6", since 00:15 UTC, ongoing.
4. US–China relations cooling — degraded, US+CN, "Bilateral tone · z −1.4", since Jul 07 22:30, ongoing.
5. Turkish lira pressure easing — degraded, TR, "USD/TRY · z +0.4", since Jul 07 14:05, resolved.
6. Eritrea macro data stale — stale, ER, "Last GDP print · 94 d old", since Apr 05, ongoing.
7. Euro-area composite PMI soft — degraded, DE+FR, "PMI · z −1.1", since Jul 06 08:00, resolved.

### 5. Right panel — Country drill-down (a country is selected)
- Back button "← All incidents".
- Flag (30×22) + country name (17/600) + region subline (mono).
- Composite state banner: tinted by state, state swatch + "Composite state" label + state name +
  source·age (e.g. "GDELT · 3 min").
- Three domain chips: Economy / Markets / Relations — each a small card with a state dot + state name in state color.
- **Key metrics** rows (each): label + source·age (mono), a small sparkline (SVG path in state
  color), value (mono) + delta (mono, state-colored), trailing state dot. Six per country:
  main equity index, 10Y bond yield, FX vs USD, inflation CPI, GDP growth, debt/GDP.
- **Top relations** (5): flag + country name + tone bar (gradient track with a marker positioned
  by z ∈ [−2,2]) + z value (mono, tone-colored).
- **Active incidents**: compact cards (dot + title + metric·since); click opens the modal.

Curated sample data (exact) — Japan, Argentina, Switzerland, United States, China, Eritrea —
is listed in the "Sample data" section below.

### 6. Incident detail modal
- Fixed overlay `rgba(6,9,12,.66)` + blur; centered 600px card.
- Header: severity dot, title, status badge, sub line (detection time + confirmation window +
  hysteresis note), close ✕.
- Body: metric name + source; an **SVG line chart** (≈560×240) with:
  - Y grid + labels (mono), area fill (amber gradient), line (amber 2px),
  - a dashed red **threshold line** at z +1.5 labeled "degraded threshold · z +1.5",
  - a **breach marker** (dot + dashed drop line + "breach 09:40" label) where the series crosses,
  - X axis time ticks.
- Below: three stat cards — Current z-score, 90d baseline μ±σ, Affected (flag + country) —
  and an explanatory paragraph about the breach + hysteresis recovery.

### 7. Methodology page (opened from rail book icon)
- Scrolls; max-width 840px reading column; back button to dashboard.
- Sections: intro; **1 Z-scores vs 90-day baseline** (with an SVG number-line diagram showing
  Operational |z|<1 (green band), Degraded 1≤|z|<2 (amber), Disrupted |z|≥2 (red), symmetric,
  with a sample marker at z −1.6); **2 Worst-of composite** (two example cards: Japan→Degraded,
  Argentina→Disrupted, showing per-domain states with "◂ worst"); **3 Hysteresis** (enter at
  |z|=1.0, recover below |z|=0.7); **4 Staleness is a state** (grey-hatch example, Eritrea 94d);
  sources footnote.

---

## Overlays (the toggle system) — behavior detail

All overlays render **together** on the same globe; each is independently on/off. The Health
metric is a separate single-select that only affects selected-country coloring.

- **Relations**: draws all bilateral relation arcs prominently + directional flow particles
  (flowing toward the larger importer). When Relations is OFF but a country is selected, only
  that country's arcs are shown. Legend: tone gradient.
- **Industries**: has a sub-mode (Key players / Supply chain, chosen in the right panel).
  - Key players: sized ranked nodes (radius ∝ share) on each key country, cyan, numbered by rank.
  - Supply chain: numbered stage nodes (color raw→finished) connected by an arched route with
    flow particles moving extraction → market.
  - Pauses globe auto-rotation while on. Right panel: industry selector chips + sub-tab toggle +
    ranked players list (share bars) or vertical numbered stage list.
- **Air traffic**: ~34 great-circle flight paths between global hub airports (faint lines +
  moving "plane" particles). Panel: busiest corridors list.
- **Satellites**: 5 orbital shells (LEO 53°, polar, LEO 28°, MEO 65°, GEO) drawn as lifted rings
  (altitude factor 1.08–1.36) with moving satellite dots. Occlusion = only hidden where the
  planet covers them. Panel: constellations list with altitude + counts (total 55).
- **Meteorological**: temperature choropleth fill on land (blue→red by latitude+seed) + rotating
  storm spirals at 5 locations. Panel: active storm systems list with category. Legend: temp scale.
- **Day / night**: night-side shading via `d3.geoCircle` centered on the anti-solar point (radius
  90°), a twilight ring, and thin timezone meridians every 15°. **No sun marker is drawn.** Panel:
  subsolar-point readout + local time per timezone (9 zones, day/night dot). Legend: night side +
  "thin meridians = 1-hour zones".

Right-panel focus rule: when no country is selected, the panel shows the **most recently toggled-on**
overlay's panel (Industries/Air/Satellites/Weather/Day-night); turning that overlay off falls back
to the incident feed. Relations and the Health metrics use the incident feed as their panel.

---

## Interactions & Behavior (summary)
- Rail Health icon → set active health metric (single-select).
- Rail Overlay icon → toggle overlay on/off (multi), and focus its panel.
- Search icon → toggle search overlay; typing filters countries; clicking a result selects + recenters.
- Click country on globe → select + recenter + show popup + drill-down panel.
- Drag globe → rotate. Auto-rotation resumes when idle (unless selected / Industries on / reduceMotion).
- Incident card → select its country; chart icon / active-incident card → open modal.
- Modal backdrop or ✕ → close.
- Methodology book icon → open page; back button → dashboard.
- Live UTC clock + freshness counter tick every second.

## State Management
Single component state:
- `domain`: 'composite' | 'economy' | 'markets' | 'conflict' (health metric, single-select).
- `overlays`: `{ relations, industry, air, sat, weather, sun }` booleans (independent).
- `focus`: which overlay panel is shown when nothing selected ('feed' | overlay id).
- `selected`: selected country name (or null).
- `modal`: incident id (or null).
- `industry`: current industry id; `indView`: 'players' | 'chain'.
- `feedFilter`: 'all' | 'ongoing' | 'resolved'.
- `searchOpen`, `searchQ`.
- `now` (UTC clock string), `freshAgo` (seconds) — updated by a 1s interval.
- Imperative globe state (not React): `lambda`, `phi` (rotation), rAF loop; canvas redraws every
  frame while visible and once per state change.

Tweakable props: `autoRotate` (bool), `reduceMotion` (bool), `accent` (color; drives `--em`,
operational, and "warm").

## Assets / dependencies
- **D3** (`d3@7` UMD; needs `d3-geo` + `d3-array`) — projection, geoPath, geoInterpolate,
  geoCircle, geoContains, geoCentroid, geoDistance.
- **topojson-client** — to build features from world-atlas topojson.
- **world-atlas** `countries-110m.json` — country polygons (properties.name).
- **flag images** — `https://flagcdn.com/40x30/<iso2>.png` (and 20x15 in lists).
- **Fonts** — IBM Plex Sans + IBM Plex Mono (Google Fonts).
- All icons are inline hand-drawn SVGs (no icon font). Requires network for D3/topojson/flags/fonts;
  bundle or self-host these in production.

## Files
- `GeoPulse.dc.html` — the full reference implementation (markup + all logic). In this project it
  is authored as a "Design Component"; the `<x-dc>` template + `class Component` logic map cleanly
  to a single framework component with the state above. Read it for exact data (curated countries,
  industries, flight hubs, orbits, storms, relation pairs with importer/imbalance) and exact SVG
  chart/diagram geometry.

## Sample data (use verbatim for parity)
- **Japan** — composite Degraded. Economy operational, Markets degraded, Relations operational.
  Nikkei 225 38,204 (−2.8% · z −1.6, degraded), 10Y JGB 0.98% (+4bp), JPY/USD 157.8 (−0.6%),
  CPI 2.8% YoY, GDP 0.9% QoQ, Debt/GDP 255%. GDP $4.2T, per-capita $33.9k, Happiness 6.06 (#51),
  pop 123.8M. Relations: US +0.8 warm, S.Korea +0.3 warm, Australia +0.6 warm, China −0.9 tense, Russia −0.7 tense.
- **Argentina** — composite Disrupted. Economy disrupted, Markets degraded. Merval 1,842,300 (+1.2%),
  10Y USD bond 24.6% (+80bp, disrupted), ARS/USD 1,285 (−1.9%), CPI 142% YoY (z +3.1), GDP −2.1% QoQ,
  Debt/GDP 88%. GDP $0.65T, per-capita $14.2k, Happiness 6.19, pop 45.8M.
- **Switzerland** — all Operational; SMI 12,140, 10Y 0.62%, CHF/USD 0.895, CPI 1.1%, GDP 0.5%,
  Debt/GDP 38%. GDP $0.88T, per-capita $99.9k, Happiness 7.06 (#9), pop 8.8M. Flat sparklines.
- **United States** — composite Degraded (Relations degraded). S&P 5,904, 10Y 4.28%, DXY 104.6,
  CPI 2.9%, GDP 2.4%, bilateral tone cooling (z −1.4).
- **China** — composite Degraded. CSI 300 3,988, 10Y 1.68%, CNY 7.28, CPI 0.3% (z −1.2), GDP 4.6%.
- **Eritrea** — composite **Stale**; markets/economy stale ("—", 94 d old), Debt/GDP 164% (94 d).
- **US↔CN** relation arc = amber, tone z −1.4.

## Recreation checklist
- [ ] Canvas globe with D3-geo orthographic; drag-rotate; click-select + recenter; idle auto-rotate.
- [ ] Neutral land; color only selected country (by Health metric) + linked partners.
- [ ] Arched, occluded connection arcs with directional flow particles.
- [ ] Independent overlay toggles that stack; single-select Health metric.
- [ ] Right panel: feed ⇄ country drill-down ⇄ per-overlay panels (focus rule).
- [ ] Incident modal with threshold line chart; methodology page with z-score diagram.
- [ ] Consistent state colors incl. stale hatch; source+age on every metric; mono numerals.
- [ ] Tweaks: autoRotate, reduceMotion, accent color.
