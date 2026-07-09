## Context

By M3 the pipeline is live and explanatory but data-poor: Economy rests on almost nothing and Relations never appears on the map. M3 adds the two slow/medium source families (macro, FX) that make Economy real, and it brings the Relations domain onto the globe as arcs. It also introduces the left-rail layer system that all future overlays plug into, and ships the methodology page the kickstart calls a launch blocker (R-3).

The design handoff specifies the arc math (arch + occlusion), the rail layout (Health single-select vs independent Overlay toggles), the focus rule, and the methodology page structure in detail; this milestone realizes those.

## Goals / Non-Goals

**Goals:**
- Economy and Markets domains score from real macro + FX data, not just equities/tone.
- Relations are visible on the globe as tone-colored, arched, correctly-occluded arcs with directional flow.
- A reusable layer system: single-select Health metric + stacking independent Overlay toggles + the right-panel focus rule.
- A complete, honest methodology page so composite scores are never presented as authoritative black boxes.

**Non-Goals:**
- Conflict data source (ACLED/UCDP) — leaning v2 (Q-2); the Conflict Health option may exist in the rail but without a live source this milestone.
- Other overlays from the design handoff (Industries, Air traffic, Satellites, Weather, Day/night) — those are additional overlays that plug into the same system later; M3 ships only Relations.
- Rate-limit chaos testing, continuous aggregates, retention, lite/full profiles — M4.

## Decisions

- **Canonical metric names, multiple sources per metric.** Macro concepts (CPI, GDP growth, debt/GDP) arrive from several providers; each writes under one canonical `metric` with its own `source` and confidence, and the scorer selects by confidence/freshness. Rationale: keeps the store source-agnostic (the M1 contract) while allowing provider redundancy. Alternative (one metric name per provider) rejected — it would fragment baselines.
- **Slow-cadence τ for macro.** Macro metrics get a large τ so a 1-day-old CPI is not treated as stale, while a 1-hour-old equity quote is. This is the same per-metric threshold config the M2 staleness indicators use. Rationale: one source of truth for "how fresh is fresh" across scorer and UI.
- **Arc rendering follows the handoff canvas math, not a generic library default.** Great-circle interpolation, radial lift `1 + h·sin(π·f)` with `h = min(0.34, geoDistance·0.17)`, and the specific occlusion test (far-hemisphere AND inside silhouette R). deck.gl ArcLayer is an option (ADR-002) but must reproduce the same arch/occlusion or we keep the canvas renderer. Rationale: visual parity with the reference and correct limb behavior.
- **Layer system = one Health single-select + a set of independent overlay booleans + a focus pointer.** Mirrors the design handoff state model exactly (`domain`, `overlays{}`, `focus`). Rationale: every future overlay (M-later) drops in without reworking the rail or panel routing.
- **Relations use the incident feed as their panel; overlays with their own panel drive focus.** Per the handoff focus rule. Rationale: consistent, predictable right-panel behavior as overlays stack.
- **Methodology content is generated from the same config as the engine where possible** (weights, τ, bands, N). Rationale: the disclosure cannot drift from the actual scoring if it reads the real config.

## Risks / Trade-offs

- **Macro provider coverage and licensing vary.** → Prefer open providers (World Bank, Eurostat, FRED) first; treat OECD/IMF SDMX as enrichment; mark confidence by source authority.
- **FX/macro cadence mismatch could make Economy jump on daily prints.** → Slow-cadence τ + hysteresis (from M2) damp daily-print jumps.
- **Arc occlusion is easy to get subtly wrong** (arcs vanishing at the limb). → Port the exact handoff test and verify visually against `GeoPulse.dc.html`.
- **Methodology page drifting from real behavior.** → Drive its numbers (bands, N, recover threshold, τ) from config, not hard-coded copy.
- **GDELT dyad noise surfacing as arc clutter.** → Keep the M1 minimum-event-count gate; optionally cap arcs to top-|tone| pairs per render.

## Migration Plan

Additive. Steps: (1) add macro-worker + fx-worker Compose services and their observations; (2) extend scoring weights/τ config for the new metrics (Economy now non-trivial); (3) add the relations/arcs API data; (4) add the arc layer + flow particles to the globe; (5) add the rail Health single-select + Overlay toggles + focus rule; (6) build the methodology route. Rollback: disable the new workers (Economy reverts toward stale) and hide the Relations toggle + methodology route; M2 behavior remains intact.

## Open Questions

- Exact canonical metric set and provider priority order for Economy (CPI, GDP growth, debt/GDP confirmed; add unemployment / PMI now or later?).
- Cap on number of arcs rendered at once for the 60 fps budget — global top-N by |tone|, or all gated pairs?
- Does the Conflict Health option ship disabled/greyed in M3, or is it hidden until the conflict-worker exists (v2)? (Lean: visible but clearly "no source yet".)
