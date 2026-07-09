## Why

The design handoff (`design_handoff_geopulse/`, including the working reference `GeoPulse.dc.html`) specifies GeoPulse's visual language at high fidelity — exact colors, state semantics, typography, layout dimensions, motion, and curated sample data — but that fidelity lives only in a README and a reference HTML file, not in the spec set. The milestone frontend specs (M1's `globe-visualization`, M2's panel/feed, M3's layers/methodology) describe *behavior* but deliberately abstract away the pixel-level contract. This change captures the handoff as normative design specs so every frontend milestone builds against one authoritative source and the result reads as a single, consistent operations console rather than an approximation.

This change is the **design foundation** the frontend milestones depend on. It satisfies the design-fidelity requirement of the handoff ("High-fidelity … recreate pixel-accurately … exact hex values, px sizes, and copy are given").

## What Changes

- Capture the **design tokens** as a normative contract: the graphite surface palette, the four health-state colors + the stale diagonal-hatch rule, the relation tone / temperature / industry-accent scales, the IBM Plex Sans / Mono type system, and the spacing / radius / shadow scale.
- Capture the **app shell**: the fixed layout skeleton (top bar 46px, left rail 72px, globe stage flex, right panel 380px), the three top-level views (dashboard, methodology page, incident modal overlay), the top-bar content, and the left-rail structure (search, single-select Health metric, independent Overlay toggles, pinned Methodology/Settings).
- Capture the **motion and accessibility** contract: the motion inventory and timings (idle rotation, arc pulse/flow, storm/satellite motion, card/modal transitions), the `reduceMotion` behavior, the tweakable `accent` color, and the single-component state model.
- Capture the **curated reference sample data** (the six countries — Japan, Argentina, Switzerland, United States, China, Eritrea — plus their relation pairs) as parity fixtures, so the UI can be validated against the reference verbatim before real data is wired in.

## Capabilities

### New Capabilities
- `design-tokens`: the normative color, state-semantic, scale, typography, and spacing/radius/shadow tokens that every surface uses.
- `app-shell`: the fixed layout skeleton, the dashboard/methodology/modal view model, and the top-bar and left-rail structure.
- `motion-and-accessibility`: the motion inventory + timings, the `reduceMotion` contract, accent tweakability, and the component state model.
- `reference-sample-data`: the curated six-country + relation-pair fixtures used for pixel-parity verification against the reference.

### Modified Capabilities
<!-- None as deltas: milestone specs are not yet archived. This change is a design contract that the frontend capabilities (globe-visualization, country-drilldown, incident-feed, domain-layers, methodology-page) conform to at implementation time. -->

## Impact

- **frontend**: establishes a shared token layer (CSS variables), the layout shell components, the motion/reduceMotion plumbing, and a sample-data fixture module. Every frontend capability in M1–M3 reads from these.
- **Source of truth**: `design_handoff_geopulse/README.md` (design tokens, layout, screens) and `GeoPulse.dc.html` (exact curated data + SVG geometry).
- **Relationship**: this change is a dependency of the frontend milestones (recommended to land before M1's globe work). It adds no backend surface.
- **Out of scope**: the five extended overlays (Industries, Air traffic, Satellites, Meteorological, Day/night) — captured separately in the `extended-overlays` change; and the per-screen behavior already specced in M1–M3.

## Depends On
