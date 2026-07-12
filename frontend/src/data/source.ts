/*
 * Data source — capability: reference-sample-data (task 4.3).
 * `fixtureSource` implements the same DataSource interface the live API will,
 * so presentation components never know whether data is demo or live. When the
 * M1 API lands, add an `apiSource` implementing DataSource and swap here (or via
 * an env flag) with zero component changes.
 */
import { COUNTRIES } from './fixtures';
import { makeApiSource } from './apiSource';
import type { CountryDetail, DataSource, DomainKey, DomainTile, Incident, IncidentDetail, Tile } from './types';

// design-system demo: synthesize incidents from the non-operational fixtures.
function fixtureIncidents(): Incident[] {
  return COUNTRIES.filter((c) => c.composite !== 'operational').map((c) => ({
    id: c.iso3,
    severity: c.composite,
    countries: [c.iso3],
    metric: c.metrics.find((m) => m.state !== 'stale')?.label ?? 'composite',
    threshold: '|z| ≥ 1.0',
    title: `${c.name} · composite ${c.composite}`,
    startedAt: 'fixture',
    resolvedAt: null,
    status: 'ongoing',
    hasChart: c.metrics.some((m) => m.series.length > 0),
  }));
}

export const fixtureSource: DataSource = {
  async tiles(): Promise<Tile[]> {
    return COUNTRIES.map((c) => ({ country: c.iso3, state: c.composite, value: 0, computedAt: 'fixture' }));
  },
  async country(iso3: string): Promise<CountryDetail | null> {
    return COUNTRIES.find((c) => c.iso3 === iso3.toUpperCase()) ?? null;
  },
  async countries(): Promise<CountryDetail[]> {
    return COUNTRIES;
  },
  async domainTiles(domain: DomainKey): Promise<DomainTile[]> {
    return COUNTRIES.map((c) => ({
      iso3: c.iso3,
      name: c.name,
      state: domain === 'composite' ? c.composite : c.domains[domain],
    }));
  },
  async incidents(status): Promise<Incident[]> {
    const all = fixtureIncidents();
    return status === 'resolved' ? [] : all;
  },
  async incident(id: string): Promise<IncidentDetail | null> {
    const c = COUNTRIES.find((x) => x.iso3 === id);
    if (!c) return null;
    const m = c.metrics.find((x) => x.series.length > 0);
    return {
      ...fixtureIncidents().find((i) => i.id === id)!,
      detail: m ? { metric: m.label, series: m.series, z: -1.6, mean: 0, std: 1, threshold_z: 1, state: c.composite } : null,
    };
  },
};

/**
 * The active data source. When VITE_API_BASE is set (M1 stack running), use the
 * live API; otherwise fall back to the reference fixtures (design-system demo).
 */
const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
export const dataSource: DataSource = API_BASE ? makeApiSource(API_BASE) : fixtureSource;
