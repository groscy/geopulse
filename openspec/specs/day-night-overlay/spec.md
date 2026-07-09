# day-night-overlay Specification

## Purpose
TBD - created by archiving change extended-overlays. Update Purpose after archive.
## Requirements
### Requirement: Terminator shading
The Day/night overlay SHALL shade the night side using a `d3.geoCircle` of radius 90° centered on the anti-solar point (computed from the current subsolar point), with a twilight ring at the terminator. No sun marker SHALL be drawn.

#### Scenario: Night side shaded
- **WHEN** the Day/night overlay is on
- **THEN** the night hemisphere is shaded with a twilight ring at the terminator and no sun marker appears

### Requirement: Timezone meridians
The overlay SHALL draw thin timezone meridians every 15° (one per hour).

#### Scenario: Meridians drawn
- **WHEN** the overlay is on
- **THEN** thin meridian lines render every 15° of longitude

### Requirement: Subsolar and timezones panel
The right panel SHALL show a subsolar-point readout (latitude, longitude) and local time for nine timezones — Los Angeles (UTC−8), New York (UTC−5), London (UTC±0), Berlin (UTC+1), Moscow (UTC+3), Delhi (UTC+5:30), Beijing (UTC+8), Tokyo (UTC+9), Sydney (UTC+10) — each with a day/night dot and label. The legend SHALL note the night side and that thin meridians are 1-hour zones.

#### Scenario: Timezone readout
- **WHEN** the Day/night overlay panel shows
- **THEN** it lists the nine timezones with current local time and a day/night indicator, plus the subsolar-point readout

