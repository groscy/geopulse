/*
 * Geo data for the globe — capability: globe-visualization.
 * Loads world-atlas countries-110m and joins polygons to tiles by ISO-3.
 *
 * world-atlas feature.id is the numeric ISO 3166-1 (M49) code. Tiles use ISO-3,
 * so we map numeric -> ISO-3. Only the countries with data need mapping; the
 * rest render as neutral land. Extend this map (or swap in a full lookup) when
 * the live API scores more countries.
 */
import { geoArea, geoCentroid } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import topoData from 'world-atlas/countries-110m.json';
import type { Feature, FeatureCollection, MultiLineString } from 'geojson';

// world-atlas feature.id (ISO 3166-1 / M49 numeric) -> ISO-3 alpha, full coverage.
export const NUMERIC_TO_ISO3: Record<number, string> = {
  4: 'AFG', 8: 'ALB', 12: 'DZA', 24: 'AGO', 32: 'ARG', 51: 'ARM', 36: 'AUS', 40: 'AUT',
  31: 'AZE', 44: 'BHS', 50: 'BGD', 112: 'BLR', 56: 'BEL', 84: 'BLZ', 204: 'BEN', 64: 'BTN',
  68: 'BOL', 70: 'BIH', 72: 'BWA', 76: 'BRA', 96: 'BRN', 100: 'BGR', 854: 'BFA', 108: 'BDI',
  116: 'KHM', 120: 'CMR', 124: 'CAN', 140: 'CAF', 148: 'TCD', 152: 'CHL', 156: 'CHN', 170: 'COL',
  178: 'COG', 188: 'CRI', 384: 'CIV', 191: 'HRV', 192: 'CUB', 196: 'CYP', 203: 'CZE', 180: 'COD',
  208: 'DNK', 262: 'DJI', 214: 'DOM', 218: 'ECU', 818: 'EGY', 222: 'SLV', 226: 'GNQ', 232: 'ERI',
  233: 'EST', 748: 'SWZ', 231: 'ETH', 242: 'FJI', 246: 'FIN', 250: 'FRA', 266: 'GAB', 270: 'GMB',
  268: 'GEO', 276: 'DEU', 288: 'GHA', 300: 'GRC', 304: 'GRL', 320: 'GTM', 324: 'GIN', 624: 'GNB',
  328: 'GUY', 332: 'HTI', 340: 'HND', 348: 'HUN', 352: 'ISL', 356: 'IND', 360: 'IDN', 364: 'IRN',
  368: 'IRQ', 372: 'IRL', 376: 'ISR', 380: 'ITA', 388: 'JAM', 392: 'JPN', 400: 'JOR', 398: 'KAZ',
  404: 'KEN', 414: 'KWT', 417: 'KGZ', 418: 'LAO', 428: 'LVA', 422: 'LBN', 426: 'LSO', 430: 'LBR',
  434: 'LBY', 440: 'LTU', 442: 'LUX', 807: 'MKD', 450: 'MDG', 454: 'MWI', 458: 'MYS', 466: 'MLI',
  478: 'MRT', 484: 'MEX', 498: 'MDA', 496: 'MNG', 499: 'MNE', 504: 'MAR', 508: 'MOZ', 104: 'MMR',
  516: 'NAM', 524: 'NPL', 528: 'NLD', 540: 'NCL', 554: 'NZL', 558: 'NIC', 562: 'NER', 566: 'NGA',
  408: 'PRK', 578: 'NOR', 512: 'OMN', 586: 'PAK', 275: 'PSE', 591: 'PAN', 598: 'PNG', 600: 'PRY',
  604: 'PER', 608: 'PHL', 616: 'POL', 620: 'PRT', 630: 'PRI', 634: 'QAT', 642: 'ROU', 643: 'RUS',
  646: 'RWA', 728: 'SSD', 682: 'SAU', 686: 'SEN', 688: 'SRB', 694: 'SLE', 703: 'SVK', 705: 'SVN',
  90: 'SLB', 706: 'SOM', 710: 'ZAF', 410: 'KOR', 724: 'ESP', 144: 'LKA', 729: 'SDN', 740: 'SUR',
  752: 'SWE', 756: 'CHE', 760: 'SYR', 158: 'TWN', 762: 'TJK', 834: 'TZA', 764: 'THA', 626: 'TLS',
  768: 'TGO', 780: 'TTO', 788: 'TUN', 792: 'TUR', 795: 'TKM', 800: 'UGA', 804: 'UKR', 784: 'ARE',
  826: 'GBR', 840: 'USA', 858: 'URY', 860: 'UZB', 548: 'VUT', 862: 'VEN', 704: 'VNM', 732: 'ESH',
  887: 'YEM', 894: 'ZMB', 716: 'ZWE',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topo = topoData as any;
const countriesObj = topo.objects.countries;

export const COUNTRY_FEATURES: Feature[] = (
  feature(topo, countriesObj) as unknown as FeatureCollection
).features;

export const BORDERS = mesh(topo, countriesObj, (a, b) => a !== b) as unknown as MultiLineString;

export function isoForFeature(f: Feature): string | null {
  const raw = f.id;
  const id = typeof raw === 'string' ? parseInt(raw, 10) : (raw as number);
  return NUMERIC_TO_ISO3[id] ?? null;
}

export function featureName(f: Feature): string {
  const p = f.properties as { name?: string } | null;
  return p?.name ?? '';
}

/** ISO-3 -> [lon, lat] centroid, for anchoring relation arcs. */
export const CENTROIDS: Record<string, [number, number]> = {};
/** country name -> [lon, lat] centroid (industries reference countries by name). */
export const CENTROIDS_BY_NAME: Record<string, [number, number]> = {};
for (const f of COUNTRY_FEATURES) {
  const c = geoCentroid(f) as [number, number];
  const iso = isoForFeature(f);
  if (iso) CENTROIDS[iso] = c;
  CENTROIDS_BY_NAME[featureName(f)] = c;
}

/**
 * ISO-3 -> [lon, lat] label anchor: the centroid of the country's LARGEST polygon
 * rather than of the whole multi-polygon. Countries with distant overseas parts
 * (France + French Guiana, USA + Alaska/Hawaii, …) otherwise anchor at an
 * ocean-bound multi-polygon centroid; the largest-polygon centroid keeps the label
 * on the mainland.
 */
export const LABEL_POINTS: Record<string, [number, number]> = {};
for (const f of COUNTRY_FEATURES) {
  const iso = isoForFeature(f);
  if (!iso) continue;
  const g = f.geometry;
  if (g && g.type === 'MultiPolygon' && g.coordinates.length > 1) {
    let best = g.coordinates[0];
    let bestArea = -1;
    for (const poly of g.coordinates) {
      const a = geoArea({ type: 'Polygon', coordinates: poly });
      if (a > bestArea) { bestArea = a; best = poly; }
    }
    LABEL_POINTS[iso] = geoCentroid({ type: 'Polygon', coordinates: best }) as [number, number];
  } else {
    LABEL_POINTS[iso] = geoCentroid(f) as [number, number];
  }
}
