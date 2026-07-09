## ADDED Requirements

### Requirement: Curated country fixtures
The frontend SHALL provide a sample-data fixture module reproducing the handoff's six curated countries verbatim, so the UI can be built and pixel-verified against the reference before live data is wired in. The fixtures SHALL cover: **Japan** (composite Degraded; Economy operational, Markets degraded, Relations operational; Nikkei 225 38,204 −2.8% z −1.6, 10Y JGB 0.98% +4bp, JPY/USD 157.8 −0.6%, CPI 2.8% YoY, GDP 0.9% QoQ, Debt/GDP 255%; GDP $4.2T, per-capita $33.9k, Happiness 6.06 #51, pop 123.8M); **Argentina** (composite Disrupted; Economy disrupted, Markets degraded; Merval 1,842,300 +1.2%, 10Y USD bond 24.6% +80bp, ARS/USD 1,285 −1.9%, CPI 142% YoY z +3.1, GDP −2.1% QoQ, Debt/GDP 88%; GDP $0.65T, per-capita $14.2k, Happiness 6.19, pop 45.8M); **Switzerland** (all Operational; SMI 12,140, 10Y 0.62%, CHF/USD 0.895, CPI 1.1%, GDP 0.5%, Debt/GDP 38%; GDP $0.88T, per-capita $99.9k, Happiness 7.06 #9, pop 8.8M; flat sparklines); **United States** (composite Degraded, Relations degraded; S&P 5,904, 10Y 4.28%, DXY 104.6, CPI 2.9%, GDP 2.4%, bilateral tone z −1.4); **China** (composite Degraded; CSI 300 3,988, 10Y 1.68%, CNY 7.28, CPI 0.3% z −1.2, GDP 4.6%); **Eritrea** (composite Stale; markets/economy stale "—" 94d old, Debt/GDP 164% 94d).

#### Scenario: Fixture drives the drill-down
- **WHEN** the country drill-down renders from fixtures for Japan
- **THEN** its composite, domain states, six metrics, and country stats match the handoff values exactly

#### Scenario: Stale country fixture
- **WHEN** Eritrea is rendered from fixtures
- **THEN** it reads as composite Stale with "—" for stale metrics and a 94-day age, never a healthy color

### Requirement: Curated relation fixtures
The fixtures SHALL include the handoff's curated bilateral relations, including Japan's — US +0.8 (warm), South Korea +0.3 (warm), Australia +0.6 (warm), China −0.9 (tense), Russia −0.7 (tense) — and the US↔CN arc (amber, tone z −1.4), so relation bars, arcs, and tone coloring can be verified against the reference.

#### Scenario: Relation tone parity
- **WHEN** Japan's top relations render from fixtures
- **THEN** the partners, tone signs, and z values match the reference, and the US↔CN arc renders amber at tone z −1.4

### Requirement: Fixtures are clearly non-production
The sample-data fixtures SHALL be isolated in a dedicated module and clearly marked as reference/demo data, so they are trivially swapped for live API data and never mistaken for real observations.

#### Scenario: Swap to live data
- **WHEN** the frontend is switched from fixtures to the live API
- **THEN** only the fixture module is replaced/bypassed, with no change to the presentation components
