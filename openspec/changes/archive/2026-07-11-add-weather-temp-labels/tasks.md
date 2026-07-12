## 1. Globe: numeric temperature labels with LOD

- [x] 1.1 Add a label pass to the Meteorological overlay in `globe/Globe.tsx`, iterating the tracked countries that have live weather data and are on the near hemisphere.
- [x] 1.2 Compute each candidate's on-screen bbox via `path.bounds`; gate/fade the label by projected width (with a minimum height), so labels appear only when the country is large enough on screen and reveal as the globe zooms in.
- [x] 1.3 Draw the rounded temperature (`N°`) centered on the country's projected centroid, in light text with a dark halo for legibility; skip countries on the synthetic latitude fallback (no live data).

## 2. Verification

- [x] 2.1 Typecheck the frontend; confirm no console errors with the Meteorological overlay on (the label pass runs every frame without throwing) and that `/api/weather` data is present so labels have values.
- [x] 2.2 Visually confirm in a real browser (GPU canvas): large countries labeled at default zoom, smaller countries revealed on zoom-in, no labels for fallback/far-hemisphere countries. *(User-confirmed: LOD threshold "fine"; France label placement fixed via largest-polygon anchor `LABEL_POINTS` and confirmed correct.)*
