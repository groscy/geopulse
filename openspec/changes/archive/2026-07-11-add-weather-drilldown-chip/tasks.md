## 1. API

- [x] 1.1 Extend `GET /api/countries/{iso3}` in `services/api/main.py` with a **weather section**: per scored facet, its committed state (from the facet `score` row), latest aggregate value (7-day mean °C / total mm / max km/h) with unit, signed anomaly z, age, and a recent series; include whatever facets have a score (dynamic), marked standalone. Leave all existing fields unchanged.

## 2. Frontend: drill-down section

- [x] 2.1 Extend `CountryDetail` types + the `data/apiSource.ts` mapping with the weather facet rows (defensive: absent section → empty, degrade to stale).
- [x] 2.2 Render a standalone **Weather** section in `panels/CountryDrilldown.tsx` (facet rows: label, value+unit, state, age) using the existing metric-row pattern, with the "standalone · not in composite" framing like News.

## 3. Verification

- [x] 3.1 Confirm `GET /api/countries/{iso3}` returns the weather facets (state/value/z/age), includes a drought facet automatically when present, marks the section standalone, and leaves the rest of the payload unchanged.
- [x] 3.2 Confirm the drill-down shows the Weather section with correct values/units/states, a warm-up facet renders stale, and the composite/other sections are unaffected.
