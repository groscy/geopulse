/*
 * Curated reference sample data — capability: reference-sample-data (tasks 4.1, 4.2).
 *
 * ⚠️ DEMO / REFERENCE DATA ONLY — transcribed verbatim from
 *    design_handoff_geopulse/GeoPulse.dc.html (and README "Sample data").
 *    NOT real observations. Swapped wholesale for the live API via data/source.ts.
 *    If you edit these, update the reference too.
 *
 * Where the handoff provides fewer than the six standard metrics for a country,
 * the missing slot is represented HONESTLY as stale ("—", no source/age), never
 * fabricated — consistent with GeoPulse's "missing is stale, not healthy" ethos.
 */
import type { CountryDetail, MetricRow, Relation } from './types';
import type { HealthState } from '../theme/colors';

/** Deterministic smooth sparkline from `from`→`to` over n points (no RNG). */
function trend(from: number, to: number, n = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // ease + tiny deterministic ripple so lines read as data, not straight rules
    const ripple = Math.sin(i * 1.7) * (Math.abs(to - from) * 0.04);
    out.push(from + (to - from) * t + ripple);
  }
  return out;
}
const flat = (v: number, n = 12): number[] => Array.from({ length: n }, () => v);

function metric(
  key: string,
  label: string,
  value: string,
  delta: string | null,
  state: HealthState,
  source: string,
  ageMin: number | null,
  series: number[],
): MetricRow {
  return { key, label, value, delta, state, source, ageMin, series };
}

/** A stale placeholder row for a metric the reference does not supply. */
function staleMetric(key: string, label: string): MetricRow {
  return metric(key, label, '—', null, 'stale', '—', null, []);
}

function rel(iso3: string, name: string, tone: number): Relation {
  const band: Relation['band'] = tone <= -0.5 ? 'hostile' : tone < 0.4 ? 'tense' : 'warm';
  return { iso3, name, tone, band };
}

export const COUNTRIES: CountryDetail[] = [
  {
    iso3: 'JPN',
    iso2: 'jp',
    name: 'Japan',
    region: 'East Asia',
    composite: 'degraded',
    source: 'GDELT',
    ageMin: 3,
    domains: { economy: 'operational', markets: 'degraded', relations: 'operational' },
    metrics: [
      metric('equity', 'Nikkei 225', '38,204', '−2.8% · z −1.6', 'degraded', 'Twelve Data', 4, trend(39400, 38204)),
      metric('bond10y', '10Y JGB', '0.98%', '+4bp', 'operational', 'FRED', 60, trend(0.94, 0.98)),
      metric('fx', 'JPY / USD', '157.8', '−0.6%', 'operational', 'exchangerate.host', 12, trend(158.7, 157.8)),
      metric('cpi', 'CPI (YoY)', '2.8%', null, 'operational', 'World Bank', 1440, flat(2.8)),
      metric('gdp', 'GDP (QoQ)', '0.9%', null, 'operational', 'OECD', 1440, flat(0.9)),
      metric('debt', 'Debt / GDP', '255%', null, 'operational', 'IMF', 1440, flat(255)),
    ],
    relations: [
      rel('USA', 'United States', 0.8),
      rel('AUS', 'Australia', 0.6),
      rel('KOR', 'South Korea', 0.3),
      rel('CHN', 'China', -0.9),
      rel('RUS', 'Russia', -0.7),
    ],
    incidents: [],
    stats: { gdp: '$4.2T', gdpPerCapita: '$33.9k', happiness: '6.06', happinessRank: 51, population: '123.8M' },
  },
  {
    iso3: 'ARG',
    iso2: 'ar',
    name: 'Argentina',
    region: 'South America',
    composite: 'disrupted',
    source: 'World Bank',
    ageMin: 30,
    domains: { economy: 'disrupted', markets: 'degraded', relations: 'operational' },
    metrics: [
      metric('equity', 'Merval', '1,842,300', '+1.2%', 'degraded', 'Twelve Data', 5, trend(1820000, 1842300)),
      metric('bond10y', '10Y USD bond', '24.6%', '+80bp', 'disrupted', 'FRED', 60, trend(23.8, 24.6)),
      metric('fx', 'ARS / USD', '1,285', '−1.9%', 'degraded', 'exchangerate.host', 12, trend(1261, 1285)),
      metric('cpi', 'CPI (YoY)', '142%', 'z +3.1', 'disrupted', 'World Bank', 1440, trend(128, 142)),
      metric('gdp', 'GDP (QoQ)', '−2.1%', null, 'disrupted', 'OECD', 1440, flat(-2.1)),
      metric('debt', 'Debt / GDP', '88%', null, 'degraded', 'IMF', 1440, flat(88)),
    ],
    relations: [],
    incidents: [],
    stats: { gdp: '$0.65T', gdpPerCapita: '$14.2k', happiness: '6.19', happinessRank: null, population: '45.8M' },
  },
  {
    iso3: 'CHE',
    iso2: 'ch',
    name: 'Switzerland',
    region: 'Central Europe',
    composite: 'operational',
    source: 'GDELT',
    ageMin: 4,
    domains: { economy: 'operational', markets: 'operational', relations: 'operational' },
    metrics: [
      metric('equity', 'SMI', '12,140', '+0.1%', 'operational', 'Twelve Data', 5, flat(12140)),
      metric('bond10y', '10Y', '0.62%', '±0bp', 'operational', 'FRED', 60, flat(0.62)),
      metric('fx', 'CHF / USD', '0.895', '±0.0%', 'operational', 'exchangerate.host', 12, flat(0.895)),
      metric('cpi', 'CPI (YoY)', '1.1%', null, 'operational', 'World Bank', 1440, flat(1.1)),
      metric('gdp', 'GDP (QoQ)', '0.5%', null, 'operational', 'OECD', 1440, flat(0.5)),
      metric('debt', 'Debt / GDP', '38%', null, 'operational', 'IMF', 1440, flat(38)),
    ],
    relations: [],
    incidents: [],
    stats: { gdp: '$0.88T', gdpPerCapita: '$99.9k', happiness: '7.06', happinessRank: 9, population: '8.8M' },
  },
  {
    iso3: 'USA',
    iso2: 'us',
    name: 'United States',
    region: 'North America',
    composite: 'degraded',
    source: 'GDELT',
    ageMin: 3,
    domains: { economy: 'operational', markets: 'operational', relations: 'degraded' },
    metrics: [
      metric('equity', 'S&P 500', '5,904', '+0.2%', 'operational', 'Finnhub', 3, trend(5890, 5904)),
      metric('bond10y', '10Y', '4.28%', '+2bp', 'operational', 'FRED', 60, trend(4.24, 4.28)),
      metric('fx', 'DXY', '104.6', '+0.1%', 'operational', 'exchangerate.host', 12, flat(104.6)),
      metric('cpi', 'CPI (YoY)', '2.9%', null, 'operational', 'World Bank', 1440, flat(2.9)),
      metric('gdp', 'GDP (QoQ)', '2.4%', null, 'operational', 'OECD', 1440, flat(2.4)),
      staleMetric('debt', 'Debt / GDP'),
    ],
    relations: [rel('CHN', 'China', -1.4)],
    incidents: [],
    stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
  },
  {
    iso3: 'CHN',
    iso2: 'cn',
    name: 'China',
    region: 'East Asia',
    composite: 'degraded',
    source: 'GDELT',
    ageMin: 3,
    domains: { economy: 'degraded', markets: 'operational', relations: 'operational' },
    metrics: [
      metric('equity', 'CSI 300', '3,988', '−0.4%', 'operational', 'Finnhub', 3, trend(4005, 3988)),
      metric('bond10y', '10Y', '1.68%', '−1bp', 'operational', 'FRED', 60, flat(1.68)),
      metric('fx', 'CNY / USD', '7.28', '±0.0%', 'operational', 'exchangerate.host', 12, flat(7.28)),
      metric('cpi', 'CPI (YoY)', '0.3%', 'z −1.2', 'degraded', 'World Bank', 1440, trend(0.9, 0.3)),
      metric('gdp', 'GDP (QoQ)', '4.6%', null, 'operational', 'OECD', 1440, flat(4.6)),
      staleMetric('debt', 'Debt / GDP'),
    ],
    relations: [rel('USA', 'United States', -1.4)],
    incidents: [],
    stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
  },
  {
    iso3: 'ERI',
    iso2: 'er',
    name: 'Eritrea',
    region: 'East Africa',
    composite: 'stale',
    source: 'World Bank',
    ageMin: null,
    domains: { economy: 'stale', markets: 'stale', relations: 'stale' },
    metrics: [
      staleMetric('equity', 'Equity index'),
      staleMetric('bond10y', '10Y'),
      staleMetric('fx', 'FX / USD'),
      staleMetric('cpi', 'CPI (YoY)'),
      staleMetric('gdp', 'GDP (QoQ)'),
      metric('debt', 'Debt / GDP', '164%', '94 d old', 'stale', 'IMF', 94 * 1440, []),
    ],
    relations: [],
    incidents: [],
    stats: { gdp: null, gdpPerCapita: null, happiness: null, happinessRank: null, population: null },
  },
];

/** The US↔CN relation arc (amber / tense, tone z −1.4) — handoff parity. */
export const RELATION_ARCS: { a: string; b: string; tone: number }[] = [
  { a: 'USA', b: 'CHN', tone: -1.4 },
];
