/*
 * Single-component state model — capability: motion-and-accessibility (task 3.4).
 * The shape the design handoff's component depends on. Imperative globe state
 * (lambda / phi / rAF loop) lives OUTSIDE this model, in the globe renderer (M1).
 */

export type HealthMetric = 'composite' | 'economy' | 'markets' | 'conflict' | 'news';

/** Meteorological overlay sub-mode — which weather facet the choropleth paints. */
export type WeatherMode = 'temp' | 'precip' | 'wind';

/** Meteorological overlay lens — absolute value vs per-country anomaly (z). */
export type WeatherView = 'value' | 'anomaly';

export type OverlayId = 'relations' | 'industry' | 'air' | 'sat' | 'weather' | 'sun';

export type Focus = 'feed' | OverlayId;

export type FeedFilter = 'all' | 'ongoing' | 'resolved';

export type IndView = 'players' | 'chain';

/** Top-level view. The incident modal is an overlay tracked separately by `modal`. */
export type View = 'dashboard' | 'methodology';

export interface Overlays {
  relations: boolean;
  industry: boolean;
  air: boolean;
  sat: boolean;
  weather: boolean;
  sun: boolean;
}

export interface AppState {
  /** single-select health metric — colors a selected country's globe fill */
  domain: HealthMetric;
  /** independent overlay toggles — any number may be on at once */
  overlays: Overlays;
  /** which panel shows when nothing is selected (focus rule) */
  focus: Focus;
  /** selected country (ISO-3) or null */
  selected: string | null;
  /** open incident id or null */
  modal: string | null;
  /** industries overlay sub-state */
  industry: string;
  indView: IndView;
  /** meteorological overlay sub-mode (temp / precip / wind choropleth) */
  weatherMode: WeatherMode;
  /** meteorological overlay lens (absolute value vs anomaly z) */
  weatherView: WeatherView;
  /** incident feed filter */
  feedFilter: FeedFilter;
  /** search overlay */
  searchOpen: boolean;
  searchQ: string;
  /** live clock, updated by a 1s interval */
  now: string; // HH:MM:SS UTC
  freshAgo: number; // seconds since last update

  /** top-level view (dashboard vs methodology); modal overlays either */
  view: View;

  /* tweakable props */
  reduceMotion: boolean;
  autoRotate: boolean;
  accent: string;
}

export const OVERLAY_IDS: OverlayId[] = ['relations', 'industry', 'air', 'sat', 'weather', 'sun'];

/** Overlays that own their own right-panel; others fall back to the feed. */
export const OVERLAYS_WITH_PANEL: OverlayId[] = ['industry', 'air', 'sat', 'weather', 'sun'];
