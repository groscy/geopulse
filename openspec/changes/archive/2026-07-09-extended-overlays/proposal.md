## Why

The design handoff specifies five globe overlays beyond the health/relations layers in the kickstart's FR-2 — Industries, Air traffic, Satellites, Meteorological, and Day/night — each with its own render behavior, curated data, right-panel content, and legend. They are fully designed in `GeoPulse.dc.html` but are not part of any milestone (M1–M4 cover the FR-2 layers only). This change captures them as normative specs so the full handoff is represented and they can be scheduled as a coherent, post-core body of work rather than rediscovered later.

These overlays are **later scope** (beyond the kickstart FR-2 v1 line): they build on the layer system introduced in M3 and the design foundation from `design-system`. Capturing them now preserves the design intent and the exact reference data without committing them to the v1 milestones.

## What Changes

- Add the **Industries overlay**: five curated industries (Semiconductors, EV batteries, Pharmaceuticals, Oil & gas, Coffee) with two sub-modes — Key players (ranked, share-sized cyan nodes) and Supply chain (numbered stage nodes, raw→finished, arched route with flow) — and their right-panel selectors/lists. Pauses globe auto-rotation while on.
- Add the **Air traffic overlay**: ~34 great-circle flight paths across 28 global hub airports with moving plane particles, and a busiest-corridors panel.
- Add the **Satellites overlay**: five orbital shells (LEO 53°, Polar, LEO 28°, MEO 65°, GEO — 55 satellites total) rendered as lifted, occlusion-correct rings with moving satellite dots, and a constellations panel.
- Add the **Meteorological overlay**: a temperature choropleth on land plus five rotating storm spirals, an active-storms panel, and the temperature-scale legend.
- Add the **Day/night overlay**: night-side shading via a geoCircle at the anti-solar point, a twilight ring, and thin timezone meridians every 15° (no sun marker), with a subsolar readout + nine-timezone local-time panel.

## Capabilities

### New Capabilities
- `industries-overlay`: the five-industry Key-players / Supply-chain visualization and panel.
- `air-traffic-overlay`: the hub-to-hub flight-path visualization and corridors panel.
- `satellites-overlay`: the five-shell orbital visualization and constellations panel.
- `meteorological-overlay`: the temperature field + storm spirals and active-storms panel.
- `day-night-overlay`: the terminator/twilight/meridian shading and subsolar + timezones panel.

### Modified Capabilities
<!-- None as deltas: milestone specs are not yet archived. These overlays plug into the M3 `domain-layers` toggle/focus system and the `design-system` tokens at implementation time. -->

## Impact

- **frontend**: five additional overlays plugging into the existing left-rail Overlay toggles and the right-panel focus rule (both from M3 `domain-layers`); each is an independent boolean that stacks on the same globe. Curated data (industries, flight hubs, orbits, storms, timezones) is transcribed verbatim from `GeoPulse.dc.html`.
- **Rendering**: all overlays share the globe's arch + occlusion helpers (great-circle arcs, lifted rings, `visible()`/silhouette test) and the `reduceMotion` contract from `design-system`.
- **Data**: these overlays are largely curated/reference data in v1; wiring any to live sources (e.g. real flight or satellite feeds) is explicitly out of scope here.
- **Dependencies**: builds on `design-system` (tokens, motion) and M3 `domain-layers` (the toggle + focus system). Recommended to schedule after M3.
- **Out of scope**: live data feeds for any overlay; the Conflict health metric's data source (that remains a v2 item in M3's scope notes).

## Depends On
- m3-full-sources
