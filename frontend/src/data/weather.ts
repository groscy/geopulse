/*
 * Weather overlay scales + mode metadata — capability: meteorological-overlay.
 * Shared by the globe choropleth (Globe.tsx) and the panel legend (OverlayPanel.tsx)
 * so the color scale and its legend never drift. Temperature is a DIVERGING six-stop
 * scale (°C, blue↔red); precipitation and wind are SEQUENTIAL (mm / km/h). Only
 * temperature has a synthetic latitude fallback — precip/wind render live-data-only.
 */
import { lerpHex, type HealthState } from '../theme/colors';
import type { WeatherField, WeatherMode, WeatherRow } from './types';

export type { WeatherMode };

/**
 * Bilinear sample of a packed-field channel at (lon, lat); null where there's no data.
 * Longitude wraps across the date line; out-of-band latitudes return null. Corners that
 * are null are dropped from the weighted average (so partial coverage still samples).
 */
export function sampleField(f: WeatherField, lon: number, lat: number, ch: 'cloud' | 'u' | 'v' | 'precip'): number | null {
  if (f.nlon <= 0 || f.nlat <= 0) return null;
  const latMax = f.latMin + (f.nlat - 1) * f.step;
  if (lat < f.latMin || lat > latMax) return null;
  const arr = f[ch];
  const flon = ((((lon + 180) % 360) + 360) % 360) / f.step; // 0..nlon (wraps)
  const flat = (lat - f.latMin) / f.step;
  const i0 = Math.floor(flon) % f.nlon, i1 = (i0 + 1) % f.nlon;
  const j0 = Math.min(Math.floor(flat), f.nlat - 1), j1 = Math.min(j0 + 1, f.nlat - 1);
  const fx = flon - Math.floor(flon), fy = flat - Math.floor(flat);
  const corners: [number | null, number][] = [
    [arr[j0 * f.nlon + i0], (1 - fx) * (1 - fy)],
    [arr[j0 * f.nlon + i1], fx * (1 - fy)],
    [arr[j1 * f.nlon + i0], (1 - fx) * fy],
    [arr[j1 * f.nlon + i1], fx * fy],
  ];
  let sum = 0, w = 0;
  for (const [c, cw] of corners) if (c != null) { sum += c * cw; w += cw; }
  return w > 0 ? sum / w : null;
}

// ascending [value, hex] stops. Temperature keeps the Phase-1 six-stop scale.
export const TEMP_STOPS: [number, string][] = [
  [-12, '#3f6fc4'], [4, '#4aa8c9'], [17, '#57ab73'], [25, '#cbb043'], [33, '#d1863f'], [42, '#cc5b52'],
];
// precipitation: 7-day total mm — dry (dark slate) → wet (bright cyan), sequential.
export const PRECIP_STOPS: [number, string][] = [
  [0, '#22303d'], [8, '#25566e'], [25, '#2b86a6'], [55, '#3fb0cc'], [100, '#83d4e6'], [160, '#dff4fa'],
];
// wind: 7-day max km/h — calm (green) → gale (red), Beaufort-like sequential.
export const WIND_STOPS: [number, string][] = [
  [0, '#2f6b4f'], [15, '#4f9d5c'], [35, '#9cb84a'], [60, '#d3a03f'], [90, '#d1863f'], [120, '#cc5b52'],
];

/** Map a value onto an ascending [value, hex] stop scale (clamped at both ends). */
export function colorForStops(v: number, stops: [number, string][]): string {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      return lerpHex(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
  }
  return stops[stops.length - 1][1];
}

const gradient = (stops: [number, string][]) => `linear-gradient(90deg,${stops.map((s) => s[1]).join(',')})`;

export interface ModeMeta {
  id: WeatherMode;
  label: string; // selector button label
  desc: string; // panel subtitle fragment
  aggLabel: string; // section label for the ranked list
  stops: [number, string][];
  fallback: boolean; // temperature falls back to latitude; precip/wind do not
  value: (r: WeatherRow) => number | null; // the aggregate this mode paints
  state: (r: WeatherRow) => HealthState; // the facet state this mode reflects
  fmt: (v: number) => string; // globe numeric label text (value + unit)
  legend: { css: string; lo: string; hi: string };
}

// ---- anomaly (z-scored) scales — the Anomaly view ----
// Temperature is DIVERGING around z=0 (cold-blue ↔ hot-red); precip/wind are
// SEQUENTIAL from z=0 up the hazard (high) tail only (their low tail isn't painted).
export const TEMP_ANOM_STOPS: [number, string][] = [
  [-4, '#3f6fc4'], [-1.5, '#5f9ac4'], [0, '#6b7480'], [1.5, '#d3a03f'], [4, '#cc5b52'],
];
export const PRECIP_ANOM_STOPS: [number, string][] = [
  [0, '#2b3a46'], [1, '#2f7796'], [2, '#3fb0cc'], [4, '#cc5b52'],
];
export const WIND_ANOM_STOPS: [number, string][] = [
  [0, '#2f4a3a'], [1, '#7fae4b'], [2, '#d3a03f'], [4, '#cc5b52'],
];

export interface AnomalyMeta {
  stops: [number, string][];
  diverging: boolean; // temp two-sided; precip/wind paint the high tail only
  legend: { css: string; lo: string; hi: string };
}

export const ANOM_META: Record<WeatherMode, AnomalyMeta> = {
  temp: { stops: TEMP_ANOM_STOPS, diverging: true, legend: { css: gradient(TEMP_ANOM_STOPS), lo: '−4σ', hi: '+4σ' } },
  precip: { stops: PRECIP_ANOM_STOPS, diverging: false, legend: { css: gradient(PRECIP_ANOM_STOPS), lo: '0', hi: '+4σ' } },
  wind: { stops: WIND_ANOM_STOPS, diverging: false, legend: { css: gradient(WIND_ANOM_STOPS), lo: '0', hi: '+4σ' } },
};

/** Anomaly fill for a facet z; null where not painted (a one-sided facet's low tail). */
export function anomalyColor(z: number, mode: WeatherMode): string | null {
  const m = ANOM_META[mode];
  const zc = Math.max(-4, Math.min(4, z));
  if (m.diverging) return colorForStops(zc, m.stops);
  if (zc <= 0) return null; // one-sided: only the hazard (high) tail is colored
  return colorForStops(zc, m.stops);
}

/** Globe z label, e.g. "+2.3σ". */
export const fmtZ = (z: number) => `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(1)}σ`;

export const MODES: WeatherMode[] = ['temp', 'precip', 'wind'];

export const MODE_META: Record<WeatherMode, ModeMeta> = {
  temp: {
    id: 'temp', label: 'Temperature', desc: '7-day mean temperature', aggLabel: 'Weekly mean',
    stops: TEMP_STOPS, fallback: true,
    value: (r) => r.tempC, state: (r) => r.states.temp,
    fmt: (v) => `${Math.round(v)}°`,
    legend: { css: gradient(TEMP_STOPS), lo: '−10°C', hi: '42°C' },
  },
  precip: {
    id: 'precip', label: 'Precipitation', desc: '7-day total precipitation', aggLabel: 'Weekly total',
    stops: PRECIP_STOPS, fallback: false,
    value: (r) => r.precipMm, state: (r) => r.states.precip,
    fmt: (v) => `${Math.round(v)}mm`,
    legend: { css: gradient(PRECIP_STOPS), lo: '0mm', hi: '160mm' },
  },
  wind: {
    id: 'wind', label: 'Wind', desc: '7-day maximum wind speed', aggLabel: 'Weekly max',
    stops: WIND_STOPS, fallback: false,
    value: (r) => r.windMax, state: (r) => r.states.wind,
    fmt: (v) => `${Math.round(v)} km/h`,
    legend: { css: gradient(WIND_STOPS), lo: '0', hi: '120 km/h' },
  },
};
