## 1. Curated data fixtures

- [x] 1.1 Transcribe the 5 industries (players + supply chains) verbatim from `GeoPulse.dc.html`.
- [x] 1.2 Transcribe the 28 flight hubs, ~34 route pairs, and 5 named corridors.
- [x] 1.3 Transcribe the 5 orbital shells (inclination/node/altitude/count/speed/color) and shell panel metadata (55 total).
- [x] 1.4 Transcribe the 5 storm systems and the 9 timezone definitions.

## 2. Shared globe helpers

- [x] 2.1 Confirm the shared arch (`1 + h·sin(π·f)`) + occlusion (far-hemisphere AND inside silhouette R) helpers are reusable by all overlays; refactor if needed.
- [x] 2.2 Confirm the shared flow-particle helper and `reduceMotion` gating are reusable.

## 3. Industries overlay

- [x] 3.1 Render Key-players mode: share-sized cyan nodes with halo/ring/centered mono rank.
- [x] 3.2 Render Supply-chain mode: numbered stage nodes (raw→finished gradient) on an arched route with extraction→market flow.
- [x] 3.3 Pause globe auto-rotation while Industries is on.
- [x] 3.4 Build the panel: industry chips, players/chain sub-tab, ranked players (share bars) / vertical stage list.

## 4. Air-traffic overlay

- [x] 4.1 Render ~34 great-circle flight paths across the 28 hubs with the arch + occlusion rules.
- [x] 4.2 Animate plane particles along each path, gated by `reduceMotion`.
- [x] 4.3 Build the busiest-corridors panel (5 corridors + total route count).

## 5. Satellites overlay

- [x] 5.1 Render the 5 orbital shells as lifted rings (altitude 1.08–1.36) with correct occlusion.
- [x] 5.2 Animate satellite dots per shell speed, gated by `reduceMotion`.
- [x] 5.3 Build the constellations panel (5 shells: band, altitude, count; total 55).

## 6. Meteorological overlay

- [x] 6.1 Render the temperature choropleth on land using the 6-stop scale at ~0.58 alpha.
- [x] 6.2 Render the 5 rotating storm spirals, gated by `reduceMotion`.
- [x] 6.3 Build the active-storms panel (name + category) and the temperature-scale legend.

## 7. Day/night overlay

- [x] 7.1 Render terminator shading via geoCircle at the anti-solar point + twilight ring; draw no sun marker.
- [x] 7.2 Draw thin timezone meridians every 15°.
- [x] 7.3 Build the panel: subsolar-point readout + 9 timezones with local time and day/night dot; legend note.

## 8. Verification

- [x] 8.1 Verify each overlay is an independent toggle that stacks with the others and follows the focus rule.
- [x] 8.2 Verify occlusion parity (rings/arcs/dots clip only what the planet covers) against `GeoPulse.dc.html`.
- [x] 8.3 Verify `reduceMotion` halts all overlay motion (planes, satellites, storms, flow).
- [x] 8.4 Spot-check the frame budget with two heavy overlays stacked; note any cap needed.
