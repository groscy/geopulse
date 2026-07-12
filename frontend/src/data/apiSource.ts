/*
 * Live API data source — capability: api-service integration.
 * Implements the SAME DataSource interface as the fixtures, mapping the M1
 * FastAPI responses (GET /api/tiles, /api/countries/{iso3}) into the frontend
 * shapes. Selected in data/source.ts when VITE_API_BASE is set.
 */
import type {
  ActiveIncident, CountryDetail, DataSource, DomainKey, DomainTile, FieldCell, HealthState, Incident, IncidentDetail, MetricRow, Relation, StormFeature, Tile, WeatherField, WeatherRow,
} from './types';

const STANDARD_METRICS: { key: string; label: string }[] = [
  { key: 'equity', label: 'Equity index' },
  { key: 'bond10y', label: '10Y yield' },
  { key: 'fx', label: 'FX / USD' },
  { key: 'cpi', label: 'CPI (YoY)' },
  { key: 'gdp', label: 'GDP (QoQ)' },
  { key: 'debt', label: 'Debt / GDP' },
];

// standalone News-domain rows (mirrors api _NEWS_SLOTS)
const NEWS_METRICS: { key: string; label: string }[] = [
  { key: 'news_tone', label: 'News tone' },
  { key: 'news_goldstein', label: 'Conflict intensity' },
  { key: 'news_volume', label: 'Coverage volume' },
];

// display names/iso2 for the incident-feed list (drill-down names come from the API)
const CLIENT: Record<string, { name: string; iso2: string }> = {
  USA: { name: 'United States', iso2: 'us' }, JPN: { name: 'Japan', iso2: 'jp' },
  DEU: { name: 'Germany', iso2: 'de' }, FRA: { name: 'France', iso2: 'fr' },
  CHE: { name: 'Switzerland', iso2: 'ch' }, GBR: { name: 'United Kingdom', iso2: 'gb' },
  CHN: { name: 'China', iso2: 'cn' }, BRA: { name: 'Brazil', iso2: 'br' },
  ARG: { name: 'Argentina', iso2: 'ar' }, IND: { name: 'India', iso2: 'in' },
  KOR: { name: 'South Korea', iso2: 'kr' }, CAN: { name: 'Canada', iso2: 'ca' },
};

const iso2 = (iso3: string) => CLIENT[iso3]?.iso2 ?? iso3.slice(0, 2).toLowerCase();
const nameOf = (iso3: string) => CLIENT[iso3]?.name ?? iso3;

function staleMetric(key: string, label: string): MetricRow {
  return { key, label, value: '—', delta: null, state: 'stale', source: '—', ageMin: null, series: [] };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const st = (v: unknown): HealthState => (v === 'operational' || v === 'degraded' || v === 'disrupted' ? v : 'stale');

/**
 * Fetch + normalize GET /api/weather into WeatherRow[] (all three facets). Tolerant
 * of an older API that predates the faceting: the legacy `{tempC, state}` shape maps
 * to `states.temp` with precip/wind degraded to `stale`, rather than crashing — the
 * frontend and API deploy independently.
 */
export async function fetchWeather(base: string): Promise<WeatherRow[]> {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/weather`);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => {
    const s = (r.states ?? {}) as Record<string, unknown>;
    const z = (r.z ?? {}) as Record<string, unknown>;
    return {
      country: String(r.country),
      tempC: num(r.tempC),
      precipMm: num(r.precipMm),
      windMax: num(r.windMax),
      states: {
        temp: st(s.temp ?? r.state), // legacy `state` == the temperature facet
        precip: st(s.precip),
        wind: st(s.wind),
      },
      z: { temp: num(z.temp), precip: num(z.precip), wind: num(z.wind) },
      ageMin: num(r.ageMin),
    };
  });
}

/**
 * Fetch + normalize GET /api/weather-field into the ambient atmospheric grid. Degrades
 * to an empty field (no cells) when absent (worker warm-up) rather than throwing on shape.
 */
export async function fetchWeatherField(base: string): Promise<WeatherField> {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/weather-field`);
  if (!res.ok) throw new Error(`weather-field ${res.status}`);
  const d = (await res.json()) as Record<string, unknown>;
  const step = num(d.step) ?? 10;
  const ts = typeof d.ts === 'string' ? d.ts : null;
  const ageMin = num(d.ageMin);
  const chan = (x: unknown) => (Array.isArray(x) ? (x as unknown[]).map((n) => (typeof n === 'number' ? n : null)) : []);
  // packed columnar form (current): dims + flat per-channel arrays
  if (Array.isArray(d.cloud)) {
    return {
      latMin: num(d.latMin) ?? -60, step, nlat: num(d.nlat) ?? 0, nlon: num(d.nlon) ?? 0,
      cloud: chan(d.cloud), u: chan(d.u), v: chan(d.v), precip: chan(d.precip), ts, ageMin,
    };
  }
  // legacy per-node form (older API): rebuild dims + flat arrays from the cells
  const cells = (Array.isArray(d.cells) ? (d.cells as FieldCell[]) : []).map((c) => ({
    lat: Number(c.lat), lon: Number(c.lon), cloud: num(c.cloud), u: num(c.u), v: num(c.v), precip: num(c.precip),
  }));
  const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
  const lons = [...new Set(cells.map((c) => c.lon))].sort((a, b) => a - b);
  const nlat = lats.length, nlon = lons.length, latMin = lats[0] ?? -60, lon0 = lons[0] ?? -180;
  const N = nlat * nlon;
  const cloud = Array<number | null>(N).fill(null), u = Array<number | null>(N).fill(null);
  const v = Array<number | null>(N).fill(null), precip = Array<number | null>(N).fill(null);
  for (const c of cells) {
    const ilat = Math.round((c.lat - latMin) / step), ilon = Math.round((c.lon - lon0) / step);
    if (ilat < 0 || ilat >= nlat || ilon < 0 || ilon >= nlon) continue;
    const idx = ilat * nlon + ilon;
    cloud[idx] = c.cloud; u[idx] = c.u; v[idx] = c.v; precip[idx] = c.precip;
  }
  return { latMin, step, nlat, nlon, cloud, u, v, precip, ts, ageMin };
}

/**
 * Fetch + normalize GET /api/storms into active cyclones. Degrades to an empty list
 * (no live storms) when absent, so the overlay falls back to its decorative set.
 */
export async function fetchStorms(base: string): Promise<StormFeature[]> {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/storms`);
  if (!res.ok) throw new Error(`storms ${res.status}`);
  const d = (await res.json()) as { storms?: Record<string, unknown>[] };
  const raw = Array.isArray(d.storms) ? d.storms : [];
  return raw.map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.name ?? 'Cyclone'),
    basin: String(s.basin ?? ''),
    lat: Number(s.lat), lon: Number(s.lon),
    category: Number(s.category ?? 0),
    categoryLabel: String(s.categoryLabel ?? ''),
    intensityKt: Number(s.intensityKt ?? 0),
    track: Array.isArray(s.track) ? (s.track as [number, number][]).map((p) => [Number(p[0]), Number(p[1])] as [number, number]) : [],
  })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

export function makeApiSource(base: string): DataSource {
  const url = (p: string) => `${base.replace(/\/$/, '')}${p}`;

  async function tiles(): Promise<Tile[]> {
    const res = await fetch(url('/api/tiles'));
    if (!res.ok) throw new Error(`tiles ${res.status}`);
    const rows = (await res.json()) as { country: string; state: HealthState; value: number | null; computed_at: string }[];
    return rows.map((r) => ({ country: r.country, state: r.state, value: r.value ?? 0, computedAt: r.computed_at }));
  }

  async function country(iso3: string): Promise<CountryDetail | null> {
    const res = await fetch(url(`/api/countries/${iso3}`));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`country ${res.status}`);
    const d = await res.json();
    const byKey = new Map<string, MetricRow>((d.metrics ?? []).map((m: MetricRow) => [m.key, m]));
    const metrics = STANDARD_METRICS.map((s) => byKey.get(s.key) ?? staleMetric(s.key, s.label));
    const newsByKey = new Map<string, MetricRow>((d.newsMetrics ?? []).map((m: MetricRow) => [m.key, m]));
    const newsMetrics = NEWS_METRICS.map((s) => newsByKey.get(s.key) ?? staleMetric(s.key, s.label));
    // standalone weather facets -> metric rows (anomaly z folded into the delta slot);
    // absent section (older API) degrades to an empty list, not a crash.
    const weatherFacets: MetricRow[] = (Array.isArray(d.weatherFacets) ? d.weatherFacets : []).map((f: Record<string, unknown>) => ({
      key: String(f.key), label: String(f.label ?? f.key), value: String(f.value ?? '—'),
      delta: typeof f.z === 'number' ? `z ${f.z > 0 ? '+' : ''}${f.z}` : null,
      state: st(f.state), source: 'Open-Meteo', ageMin: num(f.ageMin),
      series: Array.isArray(f.series) ? (f.series as number[]).map(Number) : [],
    }));
    const relations: Relation[] = (d.relations ?? []).map((r: Relation) => ({
      iso3: r.iso3, name: r.name || nameOf(r.iso3), tone: r.tone, band: r.band,
    }));
    const incidents: ActiveIncident[] = (d.incidents ?? []).map((i: ActiveIncident) => ({
      id: i.id, severity: i.severity, metric: i.metric, title: i.title, startedAt: i.startedAt,
    }));
    // Build domains defensively: the API and frontend deploy independently, so an
    // API that predates a domain (e.g. `news`) must degrade to stale, not crash.
    const dd = d.domains ?? {};
    const domains: CountryDetail['domains'] = {
      economy: (dd.economy ?? 'stale') as HealthState,
      markets: (dd.markets ?? 'stale') as HealthState,
      relations: (dd.relations ?? 'stale') as HealthState,
      news: (dd.news ?? 'stale') as HealthState,
    };
    return {
      iso3: d.iso3, iso2: iso2(d.iso3), name: d.name || nameOf(d.iso3), region: d.region ?? '',
      composite: d.composite as HealthState, source: d.source ?? 'scoring', ageMin: d.ageMin ?? null,
      domains, metrics, newsMetrics, weatherFacets, relations, incidents,
      stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
    };
  }

  async function incidents(status: 'all' | 'ongoing' | 'resolved'): Promise<Incident[]> {
    const res = await fetch(url(`/api/incidents?status=${status}`));
    if (!res.ok) throw new Error(`incidents ${res.status}`);
    return (await res.json()) as Incident[];
  }

  async function incident(id: string): Promise<IncidentDetail | null> {
    const res = await fetch(url(`/api/incidents/${id}`));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`incident ${res.status}`);
    return (await res.json()) as IncidentDetail;
  }

  async function domainTiles(domain: DomainKey): Promise<DomainTile[]> {
    // Older backends (pre-/api/domain-tiles) 404 here; degrade to an empty list so
    // the panel shows an honest empty state instead of crashing (indep. deploy).
    const res = await fetch(url(`/api/domain-tiles?domain=${domain}`));
    if (!res.ok) return [];
    const rows = (await res.json()) as { country: string; name?: string; state: unknown }[];
    return rows.map((r) => ({ iso3: r.country, name: r.name || nameOf(r.country), state: st(r.state) }));
  }

  async function countries(): Promise<CountryDetail[]> {
    // lightweight: derive the feed list from tiles (full detail comes from country())
    const t = await tiles();
    return t.map((tile) => ({
      iso3: tile.country, iso2: iso2(tile.country), name: nameOf(tile.country), region: '',
      composite: tile.state, source: 'scoring', ageMin: null,
      domains: { economy: 'stale', markets: 'stale', relations: 'stale', news: 'stale' },
      metrics: [], newsMetrics: [], relations: [], incidents: [],
      stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
    }));
  }

  return { tiles, country, countries, domainTiles, incidents, incident };
}
