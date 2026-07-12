## ADDED Requirements

### Requirement: Drought incidents
The engine SHALL open a `country:weather_drought` incident when a country's committed `weather_drought` state reaches its configured incident floor (disrupted), titled "{country} · drought", reusing the existing incident schema, dedup, and resolution lifecycle, and independent of worst-of-composite membership. It SHALL resolve independently when the deficit recovers under the hysteresis recovery rule. Flood (`weather_precip`), wind, and heat/cold incidents SHALL be unchanged.

#### Scenario: Drought opens a drought incident
- **WHEN** a country's committed `weather_drought` state reaches its incident floor (disrupted)
- **THEN** exactly one `country:weather_drought` incident is opened, titled "{country} · drought", with the deficit decomposition in `detail`

#### Scenario: Independent drought resolution
- **WHEN** a country's `weather_drought` recovers below its floor under the hysteresis recovery rule while another facet stays disrupted
- **THEN** the `country:weather_drought` incident's `resolved_at` is set while the other facet's incident stays open

#### Scenario: Wet period opens no drought incident
- **WHEN** a country's precipitation is at or above its climatological normal
- **THEN** no `country:weather_drought` incident is opened, because the facet is one-sided (deficit only)
