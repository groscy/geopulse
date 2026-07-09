## ADDED Requirements

### Requirement: Macro worker
The `macro-worker` SHALL ingest daily macroeconomic indicators — at minimum GDP growth, CPI/inflation, and debt/GDP — from World Bank, IMF SDMX, OECD, FRED, and Eurostat, normalizing each to the canonical `Observation` shape with an ISO-3 country, a canonical `metric` name, source attribution, and a confidence reflecting source authority. Macro metrics SHALL carry a slow-cadence τ so scoring discounts them appropriately.

#### Scenario: Macro indicators land
- **WHEN** the macro-worker runs its daily cycle
- **THEN** CPI, GDP growth, and debt/GDP observations are written for covered countries with correct ISO-3 codes and source attribution

#### Scenario: Provider-specific series mapped to canonical metric
- **WHEN** the same concept (e.g. CPI) is available from more than one provider
- **THEN** each is written under the same canonical `metric` name with its own `source`, so the scorer can pick by confidence/freshness

### Requirement: FX worker
The `fx-worker` SHALL ingest FX-vs-USD rates via exchangerate.host on a ~15-minute cadence and write them as `metric='fx_usd'` observations per country currency.

#### Scenario: FX rates land
- **WHEN** the fx-worker runs
- **THEN** FX-vs-USD observations are written for covered currencies at ~15-minute freshness

### Requirement: Cadence and quota compliance
The macro and FX workers SHALL honor the shared per-provider token-bucket limiter and degrade gracefully (skip cycle, keep last-known) on quota or upstream failure, consistent with the ingestion framework.

#### Scenario: Provider down
- **WHEN** a macro provider is unavailable for a cycle
- **THEN** the worker skips that provider, keeps prior observations, and does not crash or write bad values
