## ADDED Requirements

### Requirement: Weather facets in the country breakdown
`GET /api/countries/{iso3}` SHALL additionally return the country's **weather facets** as auditable rows: for each scored weather facet (`weather_temp`, `weather_precip`, `weather_wind`, and any further facet such as `weather_drought`), its committed state, its latest aggregate value (7-day mean °C / total mm / max km/h) with unit, its signed anomaly z, the reading age, and a recent series — drawn from the facet's `score` row and raw observations. The set SHALL include whatever weather facets have a score for the country (not a hardcoded list), so new facets appear automatically. The weather section SHALL be marked standalone (not part of the composite). All existing fields of the endpoint SHALL be unchanged.

#### Scenario: Drill query returns weather facets
- **WHEN** the frontend requests `GET /api/countries/JPN`
- **THEN** the response includes a weather section listing each scored facet's state, latest value with unit, anomaly z, and age, alongside the existing domains and metrics

#### Scenario: New facets appear automatically
- **WHEN** a country has a `weather_drought` score in addition to temp/precip/wind
- **THEN** the drought facet is included in the weather section without an endpoint change

#### Scenario: Existing breakdown unchanged
- **WHEN** the weather section is added
- **THEN** the composite, per-domain states, standard metrics, news metrics, relations, and incidents in the payload are unchanged, and the weather section is marked standalone
