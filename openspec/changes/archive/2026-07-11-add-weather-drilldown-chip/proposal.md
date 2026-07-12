## Why

Weather is scored per country — the `weather_temp` / `weather_precip` / `weather_wind` facets (and soon `weather_drought`) — and painted on the overlay, but the country **drill-down**, GeoPulse's auditable per-country breakdown, doesn't surface it. Click a country and you see markets / economy / relations / news and their metrics, yet not the weather facets that are driving that country's flood, wind, or heat-cold incidents. This adds a weather section to the drill-down so those facets are visible and decomposable alongside every other domain.

## What Changes

- **`GET /api/countries/{iso3}` gains a weather section.** For the country, it returns each weather facet's committed state, its latest aggregate value (7-day mean °C / total mm / max km/h), its anomaly z, and the reading age — the same auditable decomposition the other domains already expose, read from the facet `score` rows and the raw observations. Facets are included when present, so the section grows automatically as new facets (e.g. drought) come online.
- **The drill-down renders a Weather chip/section.** `CountryDrilldown.tsx` shows the weather facets as state+value rows, consistent with the existing domain chips and metric rows, labelled **standalone** (scored and incident-driving, but not part of the worst-of composite — same framing as News). No new component shape; it reuses the metric-row pattern.

## Capabilities

### Modified Capabilities
- `api-service`: `GET /api/countries/{iso3}` additionally returns the per-country weather facets (state, latest value, anomaly z, age), read from the existing facet `score` rows and observations; all other fields and endpoints are unchanged.
- `country-drilldown`: the country drill-down surfaces a standalone **Weather** section listing each facet's state and value, decomposable like the other domains.

## Impact

- **backend**: `services/api/main.py` (`/api/countries/{iso3}` adds a weather section — per-facet state from `score`, latest aggregate + z, age; reuses the `/api/weather` aggregation logic for one country).
- **frontend**: `panels/CountryDrilldown.tsx` (a Weather section of facet rows), `data/apiSource.ts` (map the weather section), `data/types.ts` (weather facet rows on `CountryDetail`).
- **Database**: none — reads existing facet `score` rows and `observation`.
- **External APIs**: none.
- **Out of scope**: a mini weather chart/sparkline per facet beyond the existing metric-row series (optional later); editing the composite; surfacing the atmospheric field or storms in the drill-down (those are global, not per-country breakdown rows).

## Depends On
- None active. Builds on the completed `add-weather-hazard-facets` (the facets and their `score` rows). Independent; forward-compatible with `add-weather-climatology-baselines` (a drought facet will appear automatically) and `add-weather-anomaly-mode` (shares the per-facet z).
