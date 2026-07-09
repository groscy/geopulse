/*
 * GeoPulse color system — capability: design-tokens (tasks 1.2, 1.3).
 *
 * Shared hex constants + scale interpolators usable by BOTH the DOM (via CSS
 * variables) and the imperative canvas globe renderer (via these functions).
 *
 * Accent: operational + the warm tone endpoint follow the tweakable accent;
 * degraded / disrupted / stale are FIXED. setAccent() (state/accent.ts) keeps
 * this module and the CSS --accent variable in lock-step, so canvas and DOM agree.
 */

export type HealthState = 'operational' | 'degraded' | 'disrupted' | 'stale';

/** Fixed state colors — never change with the accent. */
export const DEGRADED = '#d3a03f';
export const DISRUPTED = '#cc5b52';
export const STALE = '#6b7480';

/** Default accent (== operational == warm-tone endpoint). */
export const DEFAULT_ACCENT = '#3f9d6b';

let currentAccent = DEFAULT_ACCENT;

/** Called by setAccent() so canvas reads match the CSS --accent cascade. */
export function _setAccentColor(hex: string): void {
  currentAccent = hex;
}
export function accentColor(): string {
  return currentAccent;
}

/** Resolve a health state to a concrete color for the canvas renderer. */
export function stateColor(state: HealthState): string {
  switch (state) {
    case 'operational':
      return currentAccent;
    case 'degraded':
      return DEGRADED;
    case 'disrupted':
      return DISRUPTED;
    case 'stale':
      return STALE;
  }
}

/* ---- hex helpers ---- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Linear interpolation between two hex colors, t in [0,1]. */
export function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Multi-stop scale sampler. stops sorted by position in [0,1]. */
function sampleScale(stops: { at: number; hex: string }[], t: number): string {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (x >= a.at && x <= b.at) {
      const local = (x - a.at) / (b.at - a.at || 1);
      return lerpHex(a.hex, b.hex, local);
    }
  }
  return stops[x <= stops[0].at ? 0 : stops.length - 1].hex;
}

/**
 * Relation tone scale: hostile -> tense -> warm (warm follows accent).
 * Input z in [-2, 2]; negative = hostile, positive = warm.
 */
export function toneColor(z: number): string {
  const t = (Math.max(-2, Math.min(2, z)) + 2) / 4; // -> [0,1]
  return sampleScale(
    [
      { at: 0, hex: DISRUPTED }, // hostile
      { at: 0.5, hex: DEGRADED }, // tense / amber
      { at: 1, hex: currentAccent }, // warm
    ],
    t,
  );
}

/** Temperature scale (weather overlay). Input °C in [-10, 42]. */
export function temperatureColor(tempC: number): string {
  const t = (Math.max(-10, Math.min(42, tempC)) + 10) / 52;
  return sampleScale(
    [
      { at: 0, hex: '#3f6fc4' }, // -10
      { at: (4 + 10) / 52, hex: '#4aa8c9' }, // 4
      { at: (17 + 10) / 52, hex: '#57ab73' }, // 17
      { at: (25 + 10) / 52, hex: '#cbb043' }, // 25
      { at: (33 + 10) / 52, hex: '#d1863f' }, // 33
      { at: 1, hex: '#cc5b52' }, // 42
    ],
    t,
  );
}

/** Supply-chain gradient: raw -> finished (finished follows accent). */
export function chainColor(t: number): string {
  return lerpHex('#c9974a', currentAccent, Math.max(0, Math.min(1, t)));
}

export const INDUSTRY_CYAN = '#4aa8c9';
export const SAT_DOT = '#eaf4fb';
