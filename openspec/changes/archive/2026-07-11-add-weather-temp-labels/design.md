## Context

`add-weather-domain` gave the globe a per-country weather map (`weather.current: Map<iso3, tempC>`, refreshed from `/api/weather`) and a temperature choropleth. The globe is a D3-geo orthographic **canvas**, drawn imperatively each frame. This change adds numeric labels on top of that tint. The design goal is "show the number, but don't clutter" — solved with a level-of-detail rule driven by each country's on-screen size.

## Decisions

- **LOD by on-screen bounding-box width, not geographic area.** Each frame, for a candidate country, `path.bounds(feature)` gives its projected screen bbox. The label fades in as bbox **width** grows (roughly `20 → 36 px`), with a minimum height gate for vertical room. Rationale: on-screen size already folds in *both* the country's real size *and* the current zoom *and* limb foreshortening — so "smaller countries only when zoomed in" falls out for free, and a country rotating toward the limb (shrinking bbox) fades its label out naturally. Width is the gate because the text is horizontal and needs horizontal room; a country too narrow for the number correctly stays unlabeled until zoom widens it.
- **Smooth fade, not a hard pop.** The alpha ramps across the threshold band instead of switching on/off, so labels appear/disappear gracefully as the user zooms.
- **Real data only.** A label is drawn only when `weather.current` has a value for the country's ISO-3; fallback-tinted countries get none. Rationale: the fallback temperature is synthetic (latitude-derived) — showing it as a number would misrepresent it as a real reading.
- **Near hemisphere only.** Reuses the existing `visible(centroid)` helper; far-side countries are skipped (and `path.bounds` respects the `clipAngle(90)` clip, so partially-visible countries use their visible extent).
- **Placement at the centroid.** Uses the precomputed `CENTROIDS[iso3]` (falling back to `geoCentroid(feature)`), projected to screen; light text (`#eef4f9`) with a dark halo (`strokeText`) for contrast over any tint color.
- **Cost is bounded.** The pass runs only over the ≤53 tracked countries, and computes `path.bounds` only after the cheap ISO/`has-data`/`visible` guards — a handful of bounds per frame, negligible against the existing draw loop.

## Risks / Trade-offs

- **Overlap between adjacent medium countries.** The size gate limits density but does not prevent all overlap (e.g. clustered European countries at mid-zoom). Accepted for v1; a greedy de-collision pass can be added later if it reads as cluttered.
- **Very small countries may never fit a label** within the max zoom (4×). Accepted — you cannot host a number on a few-pixel country; those users can read the panel.
- **Threshold values are display-tuned.** The `20→36 px` band and `12 px` height are empirical and may be adjusted after visual review; they are implementation details, not part of the spec requirement.

## Migration Plan

Purely additive frontend rendering. Rollback = remove the label pass; the choropleth, panel, and all data paths are untouched.
