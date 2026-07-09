/*
 * Live API data source — capability: api-service integration.
 * Implements the SAME DataSource interface as the fixtures, mapping the M1
 * FastAPI responses (GET /api/tiles, /api/countries/{iso3}) into the frontend
 * shapes. Selected in data/source.ts when VITE_API_BASE is set.
 */
import type {
  ActiveIncident, CountryDetail, DataSource, HealthState, Incident, IncidentDetail, MetricRow, Relation, Tile,
} from './types';

const STANDARD_METRICS: { key: string; label: string }[] = [
  { key: 'equity', label: 'Equity index' },
  { key: 'bond10y', label: '10Y yield' },
  { key: 'fx', label: 'FX / USD' },
  { key: 'cpi', label: 'CPI (YoY)' },
  { key: 'gdp', label: 'GDP (QoQ)' },
  { key: 'debt', label: 'Debt / GDP' },
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
    const relations: Relation[] = (d.relations ?? []).map((r: Relation) => ({
      iso3: r.iso3, name: r.name || nameOf(r.iso3), tone: r.tone, band: r.band,
    }));
    const incidents: ActiveIncident[] = (d.incidents ?? []).map((i: ActiveIncident) => ({
      id: i.id, severity: i.severity, metric: i.metric, title: i.title, startedAt: i.startedAt,
    }));
    return {
      iso3: d.iso3, iso2: iso2(d.iso3), name: d.name || nameOf(d.iso3), region: d.region ?? '',
      composite: d.composite as HealthState, source: d.source ?? 'scoring', ageMin: d.ageMin ?? null,
      domains: d.domains, metrics, relations, incidents,
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

  async function countries(): Promise<CountryDetail[]> {
    // lightweight: derive the feed list from tiles (full detail comes from country())
    const t = await tiles();
    return t.map((tile) => ({
      iso3: tile.country, iso2: iso2(tile.country), name: nameOf(tile.country), region: '',
      composite: tile.state, source: 'scoring', ageMin: null,
      domains: { economy: 'stale', markets: 'stale', relations: 'stale' },
      metrics: [], relations: [], incidents: [],
      stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
    }));
  }

  return { tiles, country, countries, incidents, incident };
}
