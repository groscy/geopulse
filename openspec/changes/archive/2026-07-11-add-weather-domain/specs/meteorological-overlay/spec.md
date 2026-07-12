## MODIFIED Requirements

### Requirement: Temperature choropleth
The Meteorological overlay SHALL fill land by each country's **7-day mean surface temperature**, sourced from live `weather_temp` observations via `GET /api/weather` rather than a synthetic latitude model, using the six-stop temperature scale (`−10 #3f6fc4 · 4 #4aa8c9 · 17 #57ab73 · 25 #cbb043 · 33 #d1863f · 42 #cc5b52`) at ~0.58 alpha, and SHALL show the temperature-scale legend. When no live weather data is available for a country — including the demo/fixtures path where the API base is unset — the overlay SHALL fall back to the existing latitude-derived tint so it still renders.

#### Scenario: Land colored by temperature
- **WHEN** the Meteorological overlay is on and `/api/weather` returns per-country weekly-mean temperatures
- **THEN** land renders along the temperature scale from the real weekly means, and the legend shows the temperature stops

#### Scenario: Fallback when data absent
- **WHEN** the overlay is on but no live weather data is available (fixtures/demo, or the weather feed is empty)
- **THEN** land renders along the temperature scale using the latitude-derived fallback tint, so the overlay is never blank
