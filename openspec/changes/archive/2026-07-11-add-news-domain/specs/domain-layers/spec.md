## MODIFIED Requirements

### Requirement: Health metric single-select
The left rail SHALL provide a single-select Health metric group — Composite, Economy, Markets, Conflict, News — where exactly one is active at a time, and the active metric SHALL determine which domain colors a *selected* country on the globe. The News metric SHALL color the selected country by its `news` domain state, consistent with the other non-composite metrics; because the news domain does not feed the composite, selecting News changes only the selected-country coloring, not the composite choropleth.

#### Scenario: Switch health metric
- **WHEN** the user selects "Economy" in the rail with a country selected
- **THEN** that country is colored by its Economy domain state, and only one Health metric shows active

#### Scenario: Select News metric
- **WHEN** the user selects "News" in the rail with a country selected
- **THEN** that country is colored by its `news` domain state, and only one Health metric shows active
