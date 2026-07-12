## Context

GeoPulse's `gdelt-worker` already downloads the full GDELT 2.0 event export every 15 minutes, guarantees each parsed row has columns 0–34 present, then keeps only `AvgTone` (col 34) for cross-border ISO-3 dyads and writes `dyad_observation` rows that feed the Relations domain. The richer, already-parsed per-event fields — `QuadClass` (29), `GoldsteinScale` (30), `NumMentions`/`NumSources`/`NumArticles` (31–33) — and every domestic or single-actor event are discarded.

We want a per-country "news climate" evaluation for **all** tracked countries, without a new source, key, or LLM. GDELT's own CAMEO event coding, Goldstein weighting, and coverage tone already constitute a machine-evaluated news signal; the work is to aggregate it at the country level and route it through the existing scoring stack as a new, standalone domain.

## Goals / Non-Goals

**Goals:**
- Every tracked country receives a per-country News evaluation each cycle, independent of whether it appears in cross-border dyads.
- Reuse the existing extraction (no extra fetch), the generic `score_domain` rollup, per-metric staleness τ, four-state mapping, and hysteresis — no new scoring math.
- Surface News as a first-class, selectable Health metric and in the drill-down, visually a peer of Economy/Markets/Conflict.
- Keep the headline composite unchanged and un-double-counted.

**Non-Goals:**
- No LLM / natural-language summarization (GDELT coding is the evaluation).
- No news-driven incidents in v1 (feed-noise risk; deferrable).
- No composite participation in v1 (standalone).
- No new upstream news source; no ActionGeo/FIPS geolocation.

## Decisions

- **Per-country point metrics, article-weighted.** Aggregate events where a country is `Actor1` or `Actor2` into three point `Observation`s: `news_tone` (article-weighted mean `AvgTone`), `news_goldstein` (article-weighted mean `GoldsteinScale`), `news_volume` (summed `NumArticles`, or event count). Article-weighting lets heavily-covered events dominate, which the current flat dyad mean does not do. Rationale: point aggregation is what gives coverage for *all* countries; weighting reflects salience.
- **News is a standalone domain, excluded from the composite.** It is scored, hysteresis-committed, persisted (`domain='news'`), colored, and selectable — but `composite_of()` continues to consider only `markets`, `economy`, `relations`. Rationale: Relations is *already* GDELT-derived; letting News also drive the worst-of composite gives one source two votes and adds reactivity to the headline state. Standalone is trivially promotable later.
- **Reuse the generic rollup, not the dyad path.** `relations` is special-cased to read `dyad_observation`; `news` uses the standard `score_domain` path over point `observation` rows, so it inherits weights, τ discounting, coverage/stale logic, and hysteresis unchanged. Rationale: least new code, maximal consistency.
- **Goldstein as a first-class risk primitive.** Goldstein is a −10..+10 conflict/cooperation scale by construction, arguably a more direct instability measure than coverage tone; it is z-scored self-relative like every other metric. Rationale: it's free (already parsed) and complements tone.
- **Volume as a salience signal.** `news_volume` z-scored against the country's own baseline turns a spike in coverage into a signal independent of tone direction ("something is happening"). Rationale: catches events that move volume before they move tone.
- **Per-country minimum-article gate.** Analogous to `GDELT_MIN_EVENTS` for dyads: require a minimum article/event count before emitting a country's point obs for a window. Rationale: consistency with the existing noise gate.
- **No DB migration.** `observation.metric` and `score.domain` are free-text; new metric names and the `news` domain are additive.

## Risks / Trade-offs

- **CAMEO country codes ≈ ISO-3 but not identical.** A handful of actor codes differ from ISO-3. → Same assumption the current dyad worker already makes (the `_iso3` filter); accept and reuse it.
- **Coverage tone/Goldstein reflect *coverage*, not ground truth** (English-source and media bias). → Treated as *relative* signals (self-baseline z-scores), which is exactly what the engine does; documented on the methodology page.
- **LLM-free means no narrative "why."** The Events export carries `SOURCEURL`, not headline text. → Drill-down context is structured ("N conflict-class events, tone −5.1, volume ×3, top source domain"), not prose. Accepted per the scoping decision.
- **Bootstrap latency.** New metrics need ~`MIN_BASELINE_POINTS` (~20) points (~5 h at 15-min cadence) before leaving `stale`. → Consistent with how all metrics warm up; News reads stale until then.
- **Domain proliferation on the globe.** A 5th metric is another thing to explain. → Standalone + methodology entry keep it honest; it does not alter existing layers.

## Migration Plan

Additive, reversible. (1) Extend `gdelt-worker`'s existing loop to also aggregate per-country and emit the three point metrics; dyad path untouched. (2) Add `WEIGHTS['news']`, `DOMAIN_METRICS['news']`, τ/baseline/gate config. (3) Score `news` in the domain loop and persist it, keeping it out of `composite_of`. (4) Surface the `news` domain in the country API payload. (5) Add the News health metric to the rail/globe and the drill-down chip/rows; document on methodology. Rollback: stop emitting the new metrics and hide the News rail entry — Relations and the composite are unaffected because News never fed them.

## Open Questions

- **Aggregation scope** — count a country only as `Actor1`, or as `Actor1 ∪ Actor2` (an event naming two tracked countries counts for both)? Lean: union, since both are "in the news."
- **`news_volume` definition** — summed `NumArticles` vs raw event count vs `NumMentions`? Lean: `NumArticles` (coverage breadth).
- **Starting weights** — `WEIGHTS['news']` for tone/goldstein/volume (e.g. 1.0 / 1.0 / 0.5)? Tune after first baselines.
- **Methodology framing** — how explicitly to caption the media-coverage caveat so News isn't read as ground-truth risk.
