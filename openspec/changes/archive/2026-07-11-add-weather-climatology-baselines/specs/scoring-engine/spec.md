## ADDED Requirements

### Requirement: Day-of-year climatology baseline
The scoring engine SHALL support a per-metric **day-of-year climatology** baseline: for a facet using this mode, the latest value's z SHALL be measured against the country's climatological mean and standard deviation for the current day-of-year (over a smoothing window of ±N days), rather than a flat recent-window mean. Where a climatological normal is unavailable for a country/metric (warm-up or unsupported), the engine SHALL fall back to the existing recent self-window baseline, so a facet is never blanked by the new mode. The transform SHALL affect only the anomaly statistic; raw observations remain unchanged.

#### Scenario: Anomaly measured against the seasonal normal
- **WHEN** a facet with the climatology baseline is scored for a country that has a day-of-year normal
- **THEN** its z is computed against the climatological mean/σ for this time of year, removing the seasonal drift of a flat recent window

#### Scenario: Fallback when no normal exists
- **WHEN** a country/metric has no climatological normal yet
- **THEN** the facet is scored against the existing recent self-window baseline instead, without failing

### Requirement: Percentile precipitation anomaly
The scoring engine SHALL compute the `weather_precip` anomaly as an **empirical-CDF percentile** of the current accumulation within the country's historical precipitation distribution, mapped to an anomaly magnitude for the four-state thresholds, replacing the `log1p`-Gaussian z. The raw millimetre observations SHALL remain unchanged in storage and display. Where history is insufficient for a stable percentile, the facet SHALL fall back to the prior `log1p` path or remain stale, consistent with baseline warm-up.

#### Scenario: Precip anomaly from the empirical distribution
- **WHEN** `weather_precip` is scored for a country with sufficient history
- **THEN** its anomaly is the current accumulation's percentile in the country's own precip distribution, mapped to a z-band, not a `log1p`-Gaussian z

#### Scenario: Raw millimetres preserved
- **WHEN** the API or overlay reads `weather_precip`
- **THEN** it reads the raw millimetre accumulation (the percentile transform is not persisted)

### Requirement: Drought facet
The scoring engine SHALL score a **`weather_drought`** facet as a single-metric domain over `weather_precip`, computed as a **seasonal accumulation deficit** versus the country's climatological normal over a long window, configured `low`-sided so only a rainfall **shortfall** escalates (a wet period never opens a drought). It SHALL persist a `score` row with `domain='weather_drought'`, participate in per-facet hysteresis, and be excluded from the worst-of composite like the other weather facets. Flood detection via `weather_precip` (high tail) SHALL be unchanged.

#### Scenario: Persistent shortfall escalates drought
- **WHEN** a country's accumulated precipitation over the drought window is well below its climatological normal
- **THEN** its `weather_drought` facet escalates toward disrupted on the low (deficit) tail

#### Scenario: Wet period does not open drought
- **WHEN** a country's accumulation is at or above its normal
- **THEN** its `weather_drought` facet is operational, because the facet is one-sided (deficit only)

#### Scenario: Drought excluded from composite
- **WHEN** `weather_drought` is disrupted while markets/economy/relations are operational
- **THEN** the country's composite is unchanged, and the drought state is still persisted and served
