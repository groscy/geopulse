## 1. Token layer

- [x] 1.1 Define the surface palette, `--em` accent, neutral/dimmed land, and ocean gradient as CSS custom properties on `:root`.
- [x] 1.2 Define the four health-state colors as shared hex constants usable by both CSS and the canvas renderer; implement the stale 45° diagonal-hatch pattern (CSS gradient + canvas pattern).
- [x] 1.3 Define the relation tone, temperature (6-stop), and industry/traffic accent scales as reusable interpolators/constants.
- [x] 1.4 Import IBM Plex Sans + IBM Plex Mono; set base 13px, section-label style (10px uppercase, .11em, `--txt3`), and the mono-numerals rule.
- [x] 1.5 Define spacing/radius/shadow tokens (rail 46×72, panel padding, card/chip/modal radii, card/modal/popup shadows, legend blur).

## 2. App shell

- [x] 2.1 Build the root layout: 100vh flex column, fixed 46px top bar, body `flex:1` row (rail 72 / stage flex / panel 380), no page-level horizontal scroll.
- [x] 2.2 Build the top bar: logo mark + title + tag (home on click), center summary counts (dot + mono number + label with separators), right freshness indicator + UTC clock.
- [x] 2.3 Build the left rail: search toggle, Health single-select group, Overlays independent-toggle group, pinned Methodology/Settings; implement the 3px emerald active edge-bar + icon brightness states.
- [x] 2.4 Implement the three-view switch (dashboard / methodology / modal) preserving dashboard state across methodology and modal.
- [x] 2.5 Implement the right-panel focus rule (most-recent overlay panel; fall back to feed; drill-down when a country is selected).

## 3. Motion & accessibility

- [x] 3.1 Implement the motion utilities: `gp-slide` card transition, `gp-modal` transition, arc/opacity pulse, idle rotation cadence.
- [x] 3.2 Wire the `reduceMotion` flag to disable rotation, flow particles, and pulsing while keeping content legible.
- [x] 3.3 Wire the tweakable `accent` prop to drive `--em`, operational, and the warm tone endpoint together.
- [x] 3.4 Scaffold the single-component state model (domain/overlays/focus/selected/modal/industry/indView/feedFilter/search/now/freshAgo) with the 1s clock interval; keep globe `lambda`/`phi` imperative.

## 4. Reference sample data

- [x] 4.1 Transcribe the six curated countries (JP/AR/CH/US/CN/ER) verbatim from `GeoPulse.dc.html` into an isolated, clearly-marked fixture module.
- [x] 4.2 Transcribe the curated relation pairs (incl. Japan's five and the US↔CN arc) into the fixtures.
- [x] 4.3 Expose the fixtures behind the same interface the live API will satisfy, so components are source-agnostic.

## 5. Verification

- [x] 5.1 Render the shell + a fixture country drill-down and compare side-by-side with `GeoPulse.dc.html` for token/layout parity.
- [x] 5.2 Verify stale renders as hatch (never solid) on map and in legends/panels.
- [x] 5.3 Verify `reduceMotion` stops all motion and `accent` retheme keeps degraded/disrupted/stale unchanged.
- [x] 5.4 Verify no page-level horizontal scroll at 1440×900 and above.
