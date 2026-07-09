## Context

The design handoff fully specifies five globe overlays that the kickstart FR-2 does not list: Industries, Air traffic, Satellites, Meteorological, and Day/night. They exist as working code in `GeoPulse.dc.html` with curated data and exact geometry. Because they sit beyond the FR-2 v1 line, they are captured here as a distinct, later-scope change rather than folded into M1–M4. All five plug into the same substrate: the left-rail Overlay toggles and right-panel focus rule from M3 `domain-layers`, the tokens/motion from `design-system`, and the globe's shared arch/occlusion helpers.

## Goals / Non-Goals

**Goals:**
- Preserve the full handoff design intent and exact curated data (industries, flight hubs, orbits, storms, timezones) as normative specs.
- Specify each overlay as an independent, stackable toggle consistent with the existing layer system.
- Reuse the globe's occlusion/arch machinery and the `reduceMotion` contract rather than inventing per-overlay rendering rules.

**Non-Goals:**
- Live data for any overlay. In v1 these are curated/reference visualizations; real flight/satellite/weather feeds are out of scope.
- Changing the health scoring, incidents, or the FR-2 layers.
- The Conflict health metric's data source (remains a v2 item noted in M3).

## Decisions

- **Capture as later scope, not a v1 milestone.** These overlays are visually rich but not required by FR-2; committing them into M1–M4 would inflate the core critical path. A separate change keeps the roadmap honest while preserving the design. Rationale: matches the kickstart's scope line; lets the team schedule them after the core lands. This is why it depends on M3 (the layer system) rather than blocking it.
- **Curated data verbatim from the reference.** Industries (5, with players + chains), flight hubs (28) and routes (~34) + corridors (5), orbital shells (5, 55 sats), storms (5), and timezones (9) are transcribed exactly from `GeoPulse.dc.html`. Rationale: parity with the reference; these are the source of truth until/unless live feeds replace them.
- **Reuse shared globe helpers.** All overlays use the existing great-circle arch (`1 + h·sin(π·f)`), the lift-and-occlude test (far-hemisphere AND inside silhouette R), and flow-particle machinery. Rationale: consistent limb behavior and one place to maintain occlusion correctness. Alternative (bespoke rendering per overlay) rejected — it would drift and re-introduce occlusion bugs.
- **Industries is the one overlay that changes globe behavior.** It pauses idle auto-rotation and has a two-mode panel (players/chain) with its own selection state (`industry`, `indView`). Rationale: matches the handoff; the other four are pure additive layers.
- **Day/night draws no sun marker.** Only terminator shading, twilight ring, and 15° meridians, per the explicit handoff note. Rationale: avoids implying a literal sun sprite; the subsolar point is a panel readout.

## Risks / Trade-offs

- **Performance with many overlays stacked.** Five overlays plus relations + choropleth could stress the 60 fps budget. → Each overlay is independently toggleable; document that stacking all at once is heavy, and cap particle counts; reuse one rAF loop.
- **Occlusion correctness across overlays.** Rings, arcs, and dots must all clip only what the planet covers. → Single shared occlusion helper, verified against `GeoPulse.dc.html` per overlay.
- **Curated data reading as authoritative.** Ranked players/shares and storm categories are illustrative, not live. → Label these overlays clearly as reference data in the UI, consistent with GeoPulse's "never present as current what isn't" ethos.
- **Scope creep into live feeds.** → Explicit non-goal; any live wiring is a separate future change per overlay.

## Migration Plan

Additive, after M3. Steps: (1) transcribe the curated datasets into fixture modules; (2) implement each overlay's renderer on the shared globe helpers behind its existing rail toggle; (3) implement each overlay's right-panel per the focus rule; (4) verify occlusion/motion parity against the reference. Rollback: each overlay is an independent toggle and can ship or be disabled individually.

## Open Questions

- Ship all five together, or incrementally (e.g. Industries first, given it has the richest panel)? (Lean: incremental; they are independent.)
- Which, if any, graduate from curated to live data first (flights and weather have viable free feeds; satellites via TLE)? Park until after v1.
- Should stacking be capped (e.g. warn when >2 heavy overlays are on) to protect the frame budget? (Lean: soft — measure first.)
