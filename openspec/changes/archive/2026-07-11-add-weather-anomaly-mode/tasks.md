## 1. API

- [x] 1.1 Extend `GET /api/weather` in `services/api/main.py` to include each facet's signed anomaly z (`{temp,precip,wind}`), read from the existing facet `score` rows (null where stale); no scoring change, no other-endpoint change.

## 2. Frontend: anomaly view

- [x] 2.1 Add per-facet **anomaly scales** to `data/weather.ts` (temperature diverging around z=0; precip/wind sequential from z=0, low tail neutral) + z-label formatting; extend the weather payload type + `fetchWeather` with `z`.
- [x] 2.2 Add a **Value/Anomaly** view flag to app state (default Value) and a toggle in the Meteorological panel (`OverlayPanel.tsx`), with an anomaly legend that swaps in per active facet.
- [x] 2.3 Make the globe choropleth + numeric labels (`Globe.tsx`) view-aware: in Anomaly view color the active facet by its z on the anomaly scale and label the z; stale facets render as the stale hatch (no synthetic anomaly).
- [x] 2.4 Note on the methodology page that the overlay can display the anomaly directly (the z that drives incidents), not just the absolute value.

## 3. Verification

- [x] 3.1 Confirm `/api/weather` returns per-facet z matching the scored state (sign + magnitude), null when stale, with aggregates/states unchanged and other endpoints unaffected.
- [x] 3.2 Confirm the overlay switches Value↔Anomaly with no refetch, temperature anomaly diverges cool↔warm, precip/wind paint only the high tail, and warm-up (stale) countries show the hatch with no z label.
