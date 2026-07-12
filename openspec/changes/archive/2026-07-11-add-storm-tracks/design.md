## Context

The Meteorological overlay draws five hardcoded `STORMS` spirals (`data/overlays.ts`) as decoration. Phase 1's design reserved the `INCIDENT_DOMAINS` seam so storms could later open real incidents. Phases 2–3 made the surface facets and the atmospheric field live; storms are the remaining decorative element.

Tropical cyclones are **feature data** — a named system with a position, an intensity (Saffir-Simpson category), and a forecast track — not a per-country scalar. So, like the atmospheric field, they do **not** fit the observation→z-score→domain spine. But unlike the field, a cyclone is inherently an *event that threatens places*, so it maps naturally to `country:storm` incidents. NOAA's NHC publishes `CurrentStorms.json` (keyless, Atlantic + East Pacific) with exactly this shape.

## Goals / Non-Goals

**Goals:**
- Replace the decorative spirals with **real active cyclones** (position, category, track) from a keyless source, rendered by the existing spiral glyphs.
- Open a `country:storm` incident per threatened country via the **existing** incident schema/dedup/resolution and the reserved `INCIDENT_DOMAINS` seam — no new incident infrastructure.
- Keep storm data **out of the scoring spine** (no observation/score rows, no composite effect), consistent with the field.
- Degrade gracefully: no live storms (fixtures/demo, feed down, or genuinely no active systems) → the curated decorative set, so the overlay is never empty.

**Non-Goals (v1):**
- No non-NHC basins (JTWC West-Pacific / Indian Ocean) — NHC coverage only; global is a follow-up.
- No cone-polygon landfall geometry — proximity of position + near-term track is enough for v1.
- No storm as a z-scored domain or composite vote — storms are incidents, not risk state.
- No historical track playback — the current active snapshot only.

## Decisions

- **Feature blob store, isolated from the spine (like the field).** Active storms are cached as one `storm` blob row, overwritten each cycle. No `observation`/`score` rows. Rationale: a cyclone has no country and no z; forcing it into the observation store would break that table's per-country contract. *Alternative rejected:* a row-per-storm table with lifecycle columns — more schema for <20 concurrent systems; the worker already recomputes the full active set each cycle.

- **The worker owns incident lifecycle (not the scoring loop).** Storms are not scored, so `incident_lifecycle` (which iterates committed *domain states*) cannot open them. Instead the `storm-worker` opens/updates/resolves `country:storm` incidents directly against the existing `incident` table each cycle: dedup key `country:storm`, severity from category, `detail` carrying the storm name/category/position. A country no longer threatened by any active storm has its `country:storm` incident resolved. Rationale: reuses the incident **schema, dedup, and `/api/incidents`** unchanged — the "seam" is the incident infrastructure, not literally a scored domain. *Alternative rejected:* a synthetic storm "domain state" fed through `incident_lifecycle` — awkward (no z, no hysteresis meaning).

- **Storm → country by proximity, with a buffer to avoid flapping.** A storm threatens a tracked country when its current position (or a near-term forecast point) is within a threshold distance of that country's representative point/coast. A slightly larger *resolve* distance than *open* distance (hysteresis in space) keeps a storm skirting the threshold from opening/closing repeatedly. Severity maps category → `degraded`/`disrupted`. Rationale: cheap, good enough for a capital-point model; cone-polygon intersection is the deferred precision fix. *Alternative rejected:* exact forecast-cone polygon intersection — more geometry than v1 warrants.

- **Keyless NHC source, slow cadence.** `CurrentStorms.json` (Atlantic + East Pacific), fetched every ~1–3 h (advisories refresh ~6 h). Rationale: keyless, authoritative, matches the update rate. Global basins (JTWC etc.) are messier/less open and are a documented follow-up.

- **`GET /api/storms` serves the blob; the globe renders it; fixtures fall back.** One response with the active-storm list (id, name, basin, lat, lon, category, track points). `Globe.tsx` renders spirals at real positions sized by category and (optionally) the forecast track; when the list is empty (no live data), it falls back to the curated `STORMS` decoration so the overlay still reads. Rationale: mirrors the `/api/weather` + `/api/weather-field` "fetch once, render client-side" pattern and the temp-mode latitude-fallback honesty rule.

- **New `storm-worker` process in both Compose profiles.** Registered like the other workers, egress only to the NHC feed.

## Risks / Trade-offs

- **NHC-only coverage (no Indian Ocean / West Pacific).** → Documented v1 limitation; the render/incident path is basin-agnostic, so adding a global source later is additive. Outside NHC basins the overlay shows the decorative fallback.
- **Proximity mapping is approximate** (a storm near a coast but not making landfall may still open an incident). → Accepted for v1; the spatial buffer + category floor limit false alarms; cone-polygon intersection is the deferred fix.
- **Incident churn as storms move.** → The open/resolve distance buffer (spatial hysteresis) damps flapping; dedup `country:storm` keeps one incident per country.
- **Feed staleness / outage.** → The endpoint serves the last blob; the worker's graceful skip leaves it in place; a prolonged outage simply ages the storms (and the overlay falls back to decoration once empty), never crashes.

## Migration Plan

Additive, reversible. (1) Add the isolated `storm` blob table via the migration path. (2) Add `services/storm-worker/main.py` + config (feed URL, cadence, proximity thresholds, category→severity) and register it in Compose + supervisord (both profiles). (3) Add `GET /api/storms`; the worker opens/resolves `country:storm` incidents. (4) Frontend: fetch/hold storms, render data-backed spirals + fallback, list real systems. (5) Document on the methodology page. **Rollback:** stop the worker, drop the endpoint, revert the globe/panel to the decorative `STORMS`, resolve any open `country:storm` incidents, drop the `storm` table — the facets, field, composite, and other incidents are untouched.

## Open Questions (resolved with v1 defaults)

- **Which source?** → NHC `CurrentStorms.json` (keyless, Atlantic + E-Pacific) for v1; global basins deferred.
- **Row table or blob?** → **Blob** (single row, overwritten) — few concurrent storms, worker recomputes each cycle.
- **Render the forecast cone?** → v1 renders the spiral at position (category-sized) and optionally the track polyline; the filled cone polygon is deferred.
- **Dedup granularity?** → `country:storm` (one storm incident per country; keep the worst when multiple systems threaten one country).
