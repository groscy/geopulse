## Why

The archived `add-weather-domain` change made the Meteorological overlay data-backed: land is tinted by each country's real 7-day-mean temperature, and the panel lists warmest/coldest. But the globe shows only *color* — a user can see "warm" vs "cold" but not the actual value on the map, and reading exact numbers means cross-referencing the panel. Users want the temperature **as a number on the country**.

The obvious naive version — a label on every country always — clutters the globe badly at low zoom, where small countries overlap and there is no room for text. The fix is a **level-of-detail (LOD)** rule: show a country's number only once the country is large enough *on screen* to host it, so large countries are labeled at default zoom and smaller ones reveal their number progressively as the user zooms in.

## What Changes

- **frontend (globe only)** — add a numeric-label pass to the Meteorological overlay's globe rendering. For each tracked country with live weather data on the near hemisphere, draw its rounded temperature (e.g. `23°`) centered on the country, in light text with a dark halo for legibility over the temperature choropleth.
- **Level-of-detail** — a label is drawn (and fades in) based on the country's **on-screen size** (its projected bounding-box width), so it appears only when the country is big enough to hold the text. Because zooming scales the projection, smaller countries cross the threshold and reveal their number as the user zooms in.
- **Real data only** — labels are shown only for countries with a live `weather_temp` reading (the `/api/weather` map). Countries rendered via the synthetic latitude fallback tint get **no** number, so a fabricated value is never presented as real.
- **No backend, API, scoring, or data changes** — this consumes the existing `/api/weather` data the overlay already fetches; it is purely additive globe rendering.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `meteorological-overlay`: the overlay additionally renders per-country numeric temperature labels with a size-based level-of-detail rule.

## Impact

- **frontend**: `frontend/src/globe/Globe.tsx` — a label pass in the draw loop reusing the existing per-country weather map (`weather.current`), `path.bounds` for on-screen size, and the near-hemisphere visibility helper. No new fetch, state, or dependency.
- **Backend / API / DB**: none.
- **Out of scope**: label collision-avoidance/de-cluttering beyond the size-LOD gate (occasional overlap between adjacent medium countries is accepted for v1); labels for the synthetic fallback; labeling non-temperature metrics; a user toggle for labels (they are part of the overlay).

## Depends On
- None active. Builds on the archived `add-weather-domain` (the `/api/weather` feed and the data-backed Meteorological overlay), already merged into `openspec/specs/`.
