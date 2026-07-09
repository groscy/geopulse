/*
 * Data interfaces — capability: reference-sample-data (task 4.3).
 * These are the shapes the LIVE API (M1 api-service: GET /api/tiles,
 * GET /api/countries/{iso3}) will satisfy, so presentation components are
 * source-agnostic: fixtures today, API later, no component changes.
 */
import type { HealthState } from '../theme/colors';

export type { HealthState };

/** One globe tile — mirrors GET /api/tiles element. */
export interface Tile {
  country: string; // ISO-3
  state: HealthState;
  value: number;
  computedAt: string;
}

/** A single key-metric row in the drill-down. `ageMin: null` == stale / no data. */
export interface MetricRow {
  key: string;
  label: string;
  value: string; // pre-formatted for display (mono)
  delta: string | null;
  state: HealthState;
  source: string;
  ageMin: number | null; // minutes since observation; null => stale "—"
  series: number[]; // sparkline points (empty => flat/none)
}

export interface Relation {
  iso3: string;
  name: string;
  tone: number; // z in [-2, 2]
  band: 'hostile' | 'tense' | 'warm';
}

export interface DomainStates {
  economy: HealthState;
  markets: HealthState;
  relations: HealthState;
}

/** An incident in the global feed (GET /api/incidents). */
export interface Incident {
  id: string;
  severity: HealthState;
  countries: string[];
  metric: string | null;
  threshold: string | null;
  title: string;
  startedAt: string;
  resolvedAt: string | null;
  status: 'ongoing' | 'resolved';
  hasChart: boolean;
}

/** Full incident with chart decomposition (GET /api/incidents/{id}). */
export interface IncidentDetail extends Incident {
  detail: {
    domain?: string;
    metric?: string;
    z?: number;
    mean?: number;
    std?: number;
    latest?: number;
    series?: number[];
    threshold_z?: number;
    state?: HealthState;
    country?: string;
    age_min?: number;
  } | null;
}

/** Compact active-incident reference shown in a country drill-down. */
export interface ActiveIncident {
  id: string;
  severity: HealthState;
  metric: string | null;
  title: string;
  startedAt: string;
}

export interface CountryStats {
  gdp: string | null;
  gdpPerCapita: string | null;
  happiness: string | null;
  happinessRank: number | null;
  population: string | null;
}

/** Full per-country breakdown — mirrors GET /api/countries/{iso3}. */
export interface CountryDetail {
  iso3: string;
  iso2: string; // for flag imagery
  name: string;
  region: string;
  composite: HealthState;
  source: string;
  ageMin: number | null;
  domains: DomainStates;
  metrics: MetricRow[]; // the six standard metrics
  relations: Relation[];
  incidents: ActiveIncident[]; // active incidents for this country
  stats: CountryStats;
}

/** The read interface both fixtures and the live API implement. */
export interface DataSource {
  tiles(): Promise<Tile[]>;
  country(iso3: string): Promise<CountryDetail | null>;
  countries(): Promise<CountryDetail[]>;
  incidents(status: 'all' | 'ongoing' | 'resolved'): Promise<Incident[]>;
  incident(id: string): Promise<IncidentDetail | null>;
}
