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

/** Switchable Meteorological overlay mode — the facet the choropleth paints. */
export type WeatherMode = 'temp' | 'precip' | 'wind';

/**
 * One row of GET /api/weather — all three facet aggregates + per-facet committed
 * anomaly state, so the overlay switches modes with no refetch. Aggregates are
 * `null` where a country has no live data for that facet (its state is `stale`).
 */
export interface WeatherRow {
  country: string; // ISO-3
  tempC: number | null; // 7-day mean °C
  precipMm: number | null; // 7-day total mm
  windMax: number | null; // 7-day max km/h
  states: { temp: HealthState; precip: HealthState; wind: HealthState };
  /** signed per-facet anomaly z (null where stale) — for the Anomaly view */
  z: { temp: number | null; precip: number | null; wind: number | null };
  ageMin: number | null;
}

/** One node of the ambient atmospheric field grid (GET /api/weather-field). */
export interface FieldCell {
  lat: number;
  lon: number;
  cloud: number | null; // cloud cover %
  u: number | null; // wind east component (km/h)
  v: number | null; // wind north component (km/h)
  precip: number | null; // mm
}

/**
 * The cached global atmospheric field (GET /api/weather-field), in packed columnar
 * form: grid dimensions + flat per-channel arrays (row-major, lat outer / lon inner),
 * so a finer grid stays cheap. Ambient only — no country, no z-score; rendered as the
 * overlay's continuous cloud layer. Node (ilat, ilon) lives at index ilat*nlon + ilon,
 * lon = -180 + ilon*step, lat = latMin + ilat*step.
 */
export interface WeatherField {
  latMin: number;
  step: number;
  nlat: number;
  nlon: number;
  cloud: (number | null)[];
  u: (number | null)[];
  v: (number | null)[];
  precip: (number | null)[];
  ts: string | null;
  ageMin: number | null;
}

/** One active tropical cyclone from GET /api/storms (feature data; opens country:storm incidents). */
export interface StormFeature {
  id: string;
  name: string; // e.g. "Hurricane Alberto"
  basin: string;
  lat: number;
  lon: number;
  category: number; // Saffir-Simpson 0–5
  categoryLabel: string; // "Cat 3" / "Trop. Storm"
  intensityKt: number;
  track: [number, number][]; // near-term [lon, lat] forecast points
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
  /** standalone News domain — colored & selectable, but never feeds the composite. */
  news: HealthState;
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
  newsMetrics: MetricRow[]; // News domain rows (tone / Goldstein / volume)
  weatherFacets?: MetricRow[]; // standalone weather facets (temp/precip/wind/drought)
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
