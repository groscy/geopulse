## Context

The design handoff is authoritative and high-fidelity: `design_handoff_geopulse/README.md` gives the tokens, layout, screens, and overlay behavior, and `GeoPulse.dc.html` is a working reference implementation carrying the exact curated data and SVG geometry. Until now that fidelity was not in the spec set — the milestone frontend specs describe behavior but abstract the pixel contract. This change lifts the handoff into normative specs so the frontend milestones (M1 globe, M2 panel/feed/modal, M3 layers/methodology) all conform to one source.

This is a design contract, not a feature. It has no backend surface; it establishes the token layer, layout shell, motion plumbing, and reference fixtures that the behavioral frontend capabilities consume.

## Goals / Non-Goals

**Goals:**
- One authoritative token layer (CSS variables) for color, state semantics, scales, type, spacing/radius/shadow.
- A specified app shell: fixed skeleton, three top-level views, top-bar and rail structure, the focus rule.
- A specified motion + accessibility contract (`reduceMotion`, tweakable `accent`) and the single-component state model.
- Reference sample-data fixtures for pixel-parity verification before live data exists.

**Non-Goals:**
- The five extended overlays (Industries/Air/Satellites/Weather/Day-night) — the `extended-overlays` change.
- Per-screen behavior already specced in M1–M3 (globe interaction, drill-down content, incident lifecycle, methodology content). This change governs how those look and move, not what they do.
- Any backend/data change.

## Decisions

- **Tokens as CSS custom properties, not a JS theme object.** The handoff already expresses everything as CSS variables; keeping them as `:root` custom properties makes the accent-retheme trivial (one variable cascade) and keeps the canvas renderer and DOM in sync. Rationale: matches the reference and the tweakable-accent requirement. Alternative (theme-in-JS piped to both DOM and canvas) rejected as redundant.
- **Design-system is a change the frontend milestones depend on.** Rather than duplicate tokens into each milestone, this lands first as a foundation; M1's globe/top-bar and every later frontend capability reference it. Rationale: single source of truth, no drift. This is why it is recommended as the new dependency root ahead of M1.
- **State model captured as a contract, not a framework choice.** The spec fixes the *shape* of the single-component state (domain/overlays/focus/selected/modal/…) and that imperative globe rotation lives outside it, but leaves the framework (React per ADR-002 context) and store tooling to the implementing codebase. Rationale: the handoff's behavior depends on this shape; the tooling does not.
- **Sample data captured as an isolated fixture module.** Verbatim reference values live in one clearly-marked module so the UI can be pixel-verified against `GeoPulse.dc.html` before the API exists, then swapped for live data with no component changes. Rationale: de-risks the "recreate pixel-accurately" requirement and keeps demo data from leaking into production paths.
- **Canvas vs DOM split honored (ADR-002).** Tokens must be usable both as CSS variables (DOM: panels, cards, rail) and as resolved colors read into the canvas globe renderer. The spec keeps state colors as fixed hex so the canvas can use them directly while the DOM uses the variables.

## Risks / Trade-offs

- **Overlap with milestone frontend specs** (globe-visualization, domain-layers, methodology-page). → These are different capabilities and describe behavior; design-system describes the visual/motion contract they conform to. Keep the boundary explicit in each spec's framing to avoid contradictory requirements; where a value appears in both (e.g. state colors), design-tokens is the source of truth.
- **Fixtures drifting from the reference.** → Fixtures are transcribed verbatim from `GeoPulse.dc.html`; add a note pointing back to the reference so future edits update both.
- **Accent retheme breaking state contrast.** → Only `--em`/operational/warm follow the accent; degraded/disrupted/stale stay fixed so health contrast is preserved regardless of accent.
- **Token drift between canvas and DOM.** → Single hex constants shared by both; the canvas reads the same values the CSS variables resolve to.

## Migration Plan

Additive, foundation-first. Steps: (1) add the CSS custom-property token layer + type imports; (2) build the app-shell layout components (top bar, rail, stage container, right-panel frame) and the view switch; (3) add motion utilities + `reduceMotion`/`accent` plumbing and the state-model scaffold; (4) add the sample-data fixture module. The frontend milestones then build their behavior on top. Rollback is not meaningful (greenfield foundation); if de-scoped, the milestones would inline their own tokens.

## Open Questions

- Fonts: self-host IBM Plex vs Google Fonts CDN? (Handoff uses Google Fonts; production note says self-host — lean self-host for the local-first NFR.)
- Does the token layer ship as a tiny standalone package/module the milestones import, or just a shared stylesheet + constants file? (Lean: a shared module in the frontend app; no separate package for v1.)
- Are fixtures kept after live data lands (for Storybook-style visual regression), or removed? (Lean: keep, gated behind a demo flag.)
