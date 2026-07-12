## Why

Every weather facet currently z-scores against a **cheap 90-day self-window**, which the methodology page openly flags as drifting across seasons — a window spanning spring warming biases the mean, so the anomaly is "unusual versus the recent past," not "versus the seasonal normal." Precipitation additionally uses a `log1p` approximation over a zero-inflated distribution and detects **only floods** (the dry tail — drought — was explicitly deferred because a 90-day daily self-window is a wall of zeros with no resolution). This change makes the anomaly statistics rigorous: a **day-of-year climatology** baseline, a **percentile** precipitation anomaly, and a **drought** (dry-tail) signal on a seasonal-deficit baseline.

## What Changes

- **Day-of-year climatology baseline.** Replace (with fallback) the 90-day self-window with a **same-day-of-year normal**: the anomaly is measured against the country's climatological expectation for this time of year, from keyless Open-Meteo climate normals (or, once enough history accrues, an accumulated day-of-year mean/σ). Until the normal is available a facet SHALL fall back to the current 90-day self-window, so nothing regresses. This removes the seasonal drift for temperature (and the other facets).
- **Percentile precipitation anomaly.** Replace `log1p`-Gaussian z for `weather_precip` with an **empirical-CDF percentile**: the current accumulation's percentile within the country's historical precip distribution, mapped to an anomaly. This is robust to the zero-inflated, right-skewed shape without assuming Gaussianity, and it is what the Phase-2 design named as the deferred "clean fix."
- **Drought signal (dry tail).** Add a `weather_drought` facet: a **seasonal-deficit** anomaly — accumulated precipitation over a longer window versus its climatological normal — so a persistent rainfall shortfall registers as its own hazard. It is `low`-sided (deficit only) and opens a `country:weather_drought` incident at the disrupted floor, reusing the facet machinery. Flood detection (`weather_precip`, high tail) is unchanged.
- **Methodology update.** Replace the "cheap 90-day self-window" and "flood-only precip" caveats with the climatology/percentile/drought descriptions.

## Capabilities

### Modified Capabilities
- `scoring-engine`: adds a **day-of-year climatology baseline** (with 90-day self-window fallback) applied per metric; replaces the `weather_precip` `log1p` z with a **percentile** anomaly; and adds a **`weather_drought`** dry-tail facet on a seasonal-deficit baseline. Temperature/precip/wind facet identities are otherwise unchanged; the composite is untouched.
- `data-ingestion`: obtains the day-of-year **climatology normals** for the tracked points (a keyless Open-Meteo climate/normals fetch on a rare cadence, cached per country/day-of-year), feeding the baseline without polluting the point-observation store's fresh-value semantics.
- `incident-detection`: adds a `country:weather_drought` incident (deficit disrupted), reusing the incident schema/dedup/resolution; the existing flood/wind/heat-cold incidents are unchanged.

## Impact

- **backend**: `services/scoring-engine/main.py` (climatology baseline in the z path with fallback; percentile anomaly for precip; the `weather_drought` facet in the loop + `INCIDENT_DOMAINS`; `_incident_title` gains "drought"). `services/common/config.py` (climatology config, percentile config, `weather_drought` in `DOMAIN_METRICS`/`WEIGHTS`/`SIDED`/`TAU`/floors, seasonal-deficit window). A **normals** store (small table keyed by country + day-of-year) + a rare fetch (in `weather-worker` or a small step) + migration.
- **frontend**: none required (the drought facet can surface via the anomaly mode / drilldown changes); optionally a methodology note (this change) and a future overlay mode.
- **Database**: additive — a `weather_normal` table (country, day-of-year, metric, mean, sd); no change to `observation`/`score`/`incident` schemas.
- **External APIs**: Open-Meteo climate/normals (keyless), fetched rarely.
- **Out of scope**: any UI beyond the methodology note (the drought facet is consumed by the anomaly-mode/drilldown changes); replacing the composite; sub-national spatial climatology.

## Depends On
- None blocking. Builds on the completed `add-weather-hazard-facets` (the facet machinery, `SIDED`, `METRIC_TRANSFORM`, per-facet incidents). Pairs with `add-weather-anomaly-mode` (which will display the improved z) and `add-weather-drilldown-chip` (which can surface drought), but is independent of both.
