/*
 * Canvas globe — capabilities: globe-visualization (M1) + relations-layer +
 * domain-layers (M3).
 * D3-geo orthographic globe drawn imperatively, retina-scaled. Composite
 * choropleth from tiles (stale => hatch, unscored => neutral). When a country is
 * selected and a non-composite Health metric is active, that country is filled by
 * the chosen domain's state. Relation arcs (arched, occlusion-correct, tone-colored,
 * with flow particles) draw when the Relations overlay is on, or only the selected
 * country's arcs otherwise. Interactions: drag-rotate, zoom, hover, click-select +
 * recenter, ocean deselect, idle auto-rotate (reduceMotion-aware).
 */
import { useEffect, useRef, useState } from 'react';
import {
  geoCentroid, geoCircle, geoContains, geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath,
} from 'd3-geo';
import type { Feature } from 'geojson';
import { dataSource } from '../data/source';
import { fetchWeather, fetchWeatherField, fetchStorms } from '../data/apiSource';
import { RELATION_ARCS } from '../data/fixtures';
import { INDUSTRIES, FLIGHT_ROUTES, ORBITS, STORMS } from '../data/overlays';
import { useLive } from '../data/live';
import { useAppActions, useAppState } from '../state/store';
import type { HealthMetric } from '../state/types';
import { IDLE_ROTATION_DEG_PER_FRAME, shouldAnimate } from '../state/motion';
import { lerpHex, stateColor, toneColor, type HealthState } from '../theme/colors';
import { ANOM_META, MODE_META, TEMP_STOPS, anomalyColor, colorForStops, fmtZ, sampleField } from '../data/weather';
import type { StormFeature, WeatherField, WeatherRow } from '../data/types';
import { staleHatchPattern } from '../theme/patterns';
import { stateLabel } from '../components/bits';
import { COUNTRY_FEATURES, BORDERS, CENTROIDS, CENTROIDS_BY_NAME, LABEL_POINTS, featureName, isoForFeature } from './geo';
import { CloudGL } from './clouds-gl';

const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// Sub-solar point (lon, lat degrees) for an instant — the sun's ground position. Drives
// both the day/night terminator and the volumetric cloud lighting (shared so they agree).
function subSolarPoint(now: Date): [number, number] {
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
  const slon = ((-(utcH - 12) * 15) + 540) % 360 - 180;
  const dayOfYear = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
  const slat = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  return [slon, slat];
}

// Cached soft cloud-puff sprite (radial white gradient), drawn per grid node for the
// atmospheric field shell — far cheaper than building a gradient every node every frame.
let cloudSprite: HTMLCanvasElement | null = null;
function cloudPuff(): HTMLCanvasElement {
  if (cloudSprite) return cloudSprite;
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(236,243,250,0.95)');
  grad.addColorStop(0.5, 'rgba(224,234,246,0.45)');
  grad.addColorStop(1, 'rgba(224,234,246,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  cloudSprite = c;
  return c;
}

// ---- continuous cloud field (offscreen density texture) ----
// A low-res offscreen canvas whose pixels are inverted back to lon/lat, sampled from the
// interpolated cloud field, and modulated by value noise -> soft continuous masses.
// Rebuilt on a throttle and cached, so the per-pixel work never blocks the 60fps globe.
let cloudTex: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData | null; frame: number } | null = null;
function cloudCanvas(size: number) {
  if (!cloudTex) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    cloudTex = { c, g: c.getContext('2d')!, img: null, frame: -999 };
  }
  return cloudTex;
}
// cheap 2D value noise + 3-octave fbm (0..1) for the cloud texture.
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a: number, b: number) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
  return h(xi, yi) * (1 - u) * (1 - w) + h(xi + 1, yi) * u * (1 - w) + h(xi, yi + 1) * (1 - u) * w + h(xi + 1, yi + 1) * u * w;
}
function fbm(x: number, y: number): number {
  return vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 5, y * 2.1 + 5) * 0.3 + vnoise(x * 4.3 + 9, y * 4.3 + 9) * 0.1;
}
// Cloud render path. 'gpu' = WebGL2 raymarched volumetric shell (default when the GPU
// path is available); it degrades to 'canvas' — the retained continuous canvas-2D texture
// — when WebGL2 is absent or its context is lost. 'off' draws no cloud layer. The 'canvas'
// branch itself still supports a deeper sprite-puff fallback (CLOUD_CANVAS_SPRITES).
type CloudMode = 'gpu' | 'canvas' | 'off';
const CLOUD_MODE: CloudMode = 'gpu';
const CLOUD_CANVAS_SPRITES = false; // within the canvas path: false = continuous texture, true = sprite puffs
// synthetic latitude-derived temperature — the fallback when no live weather data
// is available for a country (fixtures/demo, or the weather feed is empty). Only
// Temperature mode has such an analog; precip/wind render live-data-only.
function tempColor(lat: number, seed: number): string {
  return colorForStops(31 - Math.abs(lat) * 0.72 + (hash(seed) - 0.5) * 9, TEMP_STOPS);
}

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const ARC_STEPS = 48;

interface Rotation { lambda: number; phi: number }
interface Hover { x: number; y: number; name: string; state: HealthState | null }
interface Arc { a: string; b: string; tone: number }

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { tiles } = useLive();
  const { selected, autoRotate, reduceMotion, overlays, domain, industry, indView, weatherMode, weatherView } = useAppState();
  const { select } = useAppActions();
  const [hover, setHover] = useState<Hover | null>(null);

  const rot = useRef<Rotation>({ lambda: 0, phi: -16 });
  const zoom = useRef(1);
  const target = useRef<Rotation | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const arcs = useRef<Arc[]>(RELATION_ARCS);
  const weather = useRef<Map<string, WeatherRow>>(new Map()); // ISO-3 -> all three facets
  const field = useRef<WeatherField | null>(null); // ambient atmospheric grid (cloud layer)
  const storms = useRef<StormFeature[]>([]); // live cyclones (real spirals + tracks)
  const selDomainState = useRef<HealthState | null>(null);
  const cloudBitmap = useRef<ImageBitmap | null>(null); // last GPU cloud frame (reused when idle)
  const cloudKey = useRef<string>(''); // camera/time/field signature of cloudBitmap

  const live = useRef({ tiles, selected, autoRotate, reduceMotion, overlays, domain, industry, indView, weatherMode, weatherView });
  live.current = { tiles, selected, autoRotate, reduceMotion, overlays, domain, industry, indView, weatherMode, weatherView };

  // arcs: from the API (or fixtures)
  useEffect(() => {
    if (!API_BASE) { arcs.current = RELATION_ARCS; return; }
    let alive = true;
    const load = () => fetch(`${API_BASE}/api/arcs`).then((r) => r.json()).then((a: Arc[]) => { if (alive) arcs.current = a; }).catch(() => {});
    load();
    const id = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // weather: per-country facet aggregates (temp/precip/wind) for the data-backed
  // Meteorological overlay. One fetch holds all three facets, so switching the
  // overlay mode never refetches. Absent in fixtures/demo (no API_BASE) => temp
  // keeps its latitude tint and precip/wind render empty.
  useEffect(() => {
    if (!API_BASE) return;
    let alive = true;
    const load = () => fetchWeather(API_BASE)
      .then((rows) => {
        if (!alive) return;
        const m = new Map<string, WeatherRow>();
        for (const r of rows) m.set(r.country, r);
        weather.current = m;
      }).catch(() => {});
    load();
    const id = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // atmospheric field: the ambient global cloud/wind grid for the lifted shell.
  // Slow-moving field, cached server-side; refetch occasionally. Empty in fixtures/demo
  // (no API_BASE) => the shell simply renders nothing (honest empty state).
  useEffect(() => {
    if (!API_BASE) return;
    let alive = true;
    const load = () => fetchWeatherField(API_BASE)
      .then((f) => { if (alive) field.current = f; }).catch(() => {});
    load();
    const id = window.setInterval(load, 300000); // 5 min — field drifts slowly
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // storms: live active cyclones (real position/category/track). Empty in fixtures/demo
  // (no API_BASE) => the overlay falls back to the curated decorative spirals.
  useEffect(() => {
    if (!API_BASE) return;
    let alive = true;
    const load = () => fetchStorms(API_BASE)
      .then((s) => { if (alive) storms.current = s; }).catch(() => {});
    load();
    const id = window.setInterval(load, 300000); // 5 min — advisories refresh slowly
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // selected country's chosen-domain state (Health single-select coloring)
  useEffect(() => {
    if (!selected || domain === 'composite') { selDomainState.current = null; return; }
    let alive = true;
    const key: Record<HealthMetric, 'economy' | 'markets' | 'relations' | 'news' | null> = {
      composite: null, economy: 'economy', markets: 'markets', conflict: null, news: 'news',
    };
    const dk = key[domain];
    if (!dk) { selDomainState.current = 'stale'; return; }
    dataSource.country(selected).then((c) => { if (alive && c) selDomainState.current = c.domains[dk]; });
    return () => { alive = false; };
  }, [selected, domain]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const projection = geoOrthographic().clipAngle(90);
    const arcProj = geoOrthographic().clipAngle(180); // unclipped: far-side points still project
    const path = geoPath(projection, ctx);

    // GPU cloud renderer (WebGL2). null when unavailable => the canvas-2D path is used.
    // Guarded so a GL setup failure can never abort the globe render (fallback, not crash).
    let cloudGL: CloudGL | null = null;
    if (CLOUD_MODE !== 'off') {
      try { cloudGL = CloudGL.create(); } catch (e) { console.error('[globe] CloudGL.create threw', e); }
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      size.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tileState = (): Map<string, HealthState> => {
      const m = new Map<string, HealthState>();
      for (const t of live.current.tiles) m.set(t.country, t.state);
      return m;
    };

    // arc drawing: great-circle, arched (1 + h·sin(π·f)), occlusion = far-hemisphere AND inside R
    const drawArcPts = (pa: [number, number], pb: [number, number], color: string, cx: number, cy: number, R: number, center: [number, number], time: number, flow: boolean) => {
      const interp = geoInterpolate(pa, pb);
      const gd = geoDistance(pa, pb);
      const h = Math.min(0.34, gd * 0.17);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= ARC_STEPS; i++) {
        const f = i / ARC_STEPS;
        const p = interp(f);
        const s = arcProj(p as [number, number]);
        if (!s) { started = false; continue; }
        const L = 1 + h * Math.sin(Math.PI * f);
        const lx = cx + (s[0] - cx) * L, ly = cy + (s[1] - cy) * L;
        const hidden = geoDistance(p as [number, number], center) > Math.PI / 2 && Math.hypot(lx - cx, ly - cy) < R;
        if (hidden) { started = false; continue; }
        if (!started) { ctx.moveTo(lx, ly); started = true; } else ctx.lineTo(lx, ly);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(time * 1.6 + h * 20);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (flow) {
        for (let k = 0; k < 3; k++) {
          const f = ((time * 0.12 + k / 3) % 1);
          const p = interp(f);
          const s = arcProj(p as [number, number]);
          if (!s) continue;
          const L = 1 + h * Math.sin(Math.PI * f);
          const lx = cx + (s[0] - cx) * L, ly = cy + (s[1] - cy) * L;
          if (geoDistance(p as [number, number], center) > Math.PI / 2 && Math.hypot(lx - cx, ly - cy) < R) continue;
          ctx.beginPath();
          ctx.arc(lx, ly, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = Math.sin(Math.PI * f);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };
    // relation arc: resolve centroids by ISO-3 and color by tone
    const drawArc = (a: string, b: string, tone: number, cx: number, cy: number, R: number, center: [number, number], time: number, flow: boolean) => {
      const pa = CENTROIDS[a], pb = CENTROIDS[b];
      if (pa && pb) drawArcPts(pa, pb, toneColor(tone), cx, cy, R, center, time, flow);
    };

    let raf = 0;
    let frame = 0;
    const draw = () => {
      frame += 1;
      const time = frame / 60;
      const { w, h, dpr } = size.current;
      const { selected: sel, autoRotate: auto, reduceMotion: rm, overlays: ov, domain: dom, weatherMode: wmode, weatherView: wview } = live.current;
      const states = tileState();
      const animate = shouldAnimate(rm);

      if (target.current) {
        const tt = target.current;
        rot.current.lambda += (tt.lambda - rot.current.lambda) * 0.12;
        rot.current.phi += (tt.phi - rot.current.phi) * 0.12;
        if (Math.abs(tt.lambda - rot.current.lambda) < 0.05 && Math.abs(tt.phi - rot.current.phi) < 0.05) {
          rot.current = { ...tt };
          target.current = null;
        }
      } else if (auto && animate && !drag.current && !sel && !ov.industry) {
        rot.current.lambda += IDLE_ROTATION_DEG_PER_FRAME;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const scale = Math.min(w, h) * 0.42 * zoom.current;
      const cx = w / 2, cy = h * 0.5;
      const rotate: [number, number] = [rot.current.lambda, rot.current.phi];
      projection.scale(scale).translate([cx, cy]).rotate(rotate);
      arcProj.scale(scale).translate([cx, cy]).rotate(rotate);
      const center: [number, number] = [-rot.current.lambda, -rot.current.phi];
      const R = scale;
      const visible = (ll: [number, number]) => geoDistance(ll, center) < Math.PI / 2;
      const lift = (ll: [number, number], alt: number): [number, number] | null => {
        const s = arcProj(ll); if (!s) return null; return [cx + (s[0] - cx) * alt, cy + (s[1] - cy) * alt];
      };
      const drawNode = (ll: [number, number], radius: number, fill: string, textColor: string, label: string) => {
        if (!visible(ll)) return;
        const s = projection(ll); if (!s) return;
        ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.arc(s[0], s[1], radius * 1.9, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(s[0], s[1], radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
        ctx.beginPath(); ctx.arc(s[0], s[1], radius, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = textColor; ctx.font = `600 ${Math.max(8, radius * 0.85)}px "IBM Plex Mono", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, s[0], s[1]);
      };

      // atmosphere
      const atm = ctx.createRadialGradient(cx, cy, scale * 0.96, cx, cy, scale * 1.12);
      atm.addColorStop(0, 'rgba(72,158,185,0.18)');
      atm.addColorStop(1, 'rgba(72,158,185,0)');
      ctx.beginPath(); ctx.arc(cx, cy, scale * 1.12, 0, Math.PI * 2); ctx.fillStyle = atm; ctx.fill();

      // ocean
      const ocean = ctx.createRadialGradient(cx, cy - scale * 0.08, scale * 0.2, cx, cy, scale);
      ocean.addColorStop(0, '#131c26'); ocean.addColorStop(1, '#0a0f15');
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = ocean; ctx.fill();

      // graticule
      ctx.beginPath(); path(geoGraticule10()); ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 0.5; ctx.stroke();

      // country fills (composite choropleth; selected recolored by chosen Health domain)
      for (const f of COUNTRY_FEATURES) {
        const iso = isoForFeature(f);
        let st = iso ? states.get(iso) : undefined;
        if (iso && iso === sel && dom !== 'composite') st = selDomainState.current ?? 'stale';
        ctx.beginPath(); path(f);
        if (st === 'stale') ctx.fillStyle = staleHatchPattern(ctx) ?? '#1c242e';
        else if (st) ctx.fillStyle = stateColor(st);
        else ctx.fillStyle = '#1c242e';
        ctx.fill();
      }

      // meteorological: mode-aware choropleth (tint land), alpha .58. The Value view
      // paints each country by its facet aggregate on that facet's scale (temperature
      // keeps a latitude fallback; precip/wind render only where live data exists). The
      // Anomaly view paints by the facet's per-country z on a diverging (temp) or
      // high-tail (precip/wind) scale, live-data-only (stale => no fill).
      if (ov.weather) {
        const spec = MODE_META[wmode];
        const anom = wview === 'anomaly';
        ctx.globalAlpha = 0.58;
        const wx = weather.current;
        for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
          const f = COUNTRY_FEATURES[i];
          const iso = isoForFeature(f);
          const row = iso ? wx.get(iso) : undefined;
          if (anom) {
            const z = row ? row.z[wmode] : null;
            const col = z === null || z === undefined ? null : anomalyColor(z, wmode);
            if (col) { ctx.beginPath(); path(f); ctx.fillStyle = col; ctx.fill(); }
            continue; // no synthetic anomaly fallback (stale / low tail -> no fill)
          }
          const v = row ? spec.value(row) : null;
          if (v !== null && v !== undefined) {
            ctx.beginPath(); path(f);
            ctx.fillStyle = colorForStops(v, spec.stops);
            ctx.fill();
          } else if (spec.fallback) {
            ctx.beginPath(); path(f);
            const c = CENTROIDS[iso ?? ''] ?? (geoCentroid(f) as [number, number]);
            ctx.fillStyle = tempColor(c[1], i);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // borders
      ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(9,13,17,0.85)'; ctx.lineWidth = 0.55; ctx.stroke();

      // day / night: terminator via geoCircle at the anti-solar point + meridians (no sun marker)
      if (ov.sun) {
        const [slon, slat] = subSolarPoint(new Date());
        const anti: [number, number] = [((slon + 180 + 540) % 360) - 180, -slat];
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.6;
        for (let lon = -180; lon < 180; lon += 15) {
          ctx.beginPath();
          path({ type: 'LineString', coordinates: Array.from({ length: 42 }, (_, k) => [lon, -82 + k * 4]) });
          ctx.stroke();
        }
        ctx.beginPath(); path(geoCircle().center(anti).radius(90)()); ctx.fillStyle = 'rgba(5,8,15,0.62)'; ctx.fill();
        ctx.beginPath(); path(geoCircle().center(anti).radius(84)()); ctx.strokeStyle = 'rgba(120,150,195,0.32)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // relation arcs: all when Relations overlay on; else only the selected country's
      const showAll = ov.relations;
      if (showAll || sel) {
        for (const arc of arcs.current) {
          if (!showAll && arc.a !== sel && arc.b !== sel) continue;
          drawArc(arc.a, arc.b, arc.tone, cx, cy, R, center, animate ? time : 0, animate);
        }
      }

      // industries: key players (sized cyan nodes) or supply chain (numbered stages + arched route)
      if (ov.industry) {
        const ind = INDUSTRIES.find((x) => x.id === live.current.industry) ?? INDUSTRIES[0];
        if (live.current.indView === 'chain') {
          for (let i = 0; i < ind.chain.length - 1; i++) {
            const a = CENTROIDS_BY_NAME[ind.chain[i].country], b = CENTROIDS_BY_NAME[ind.chain[i + 1].country];
            if (a && b) drawArcPts(a, b, '#5fb0cc', cx, cy, R, center, animate ? time : 0, animate);
          }
          ind.chain.forEach((sg, i) => {
            const c = CENTROIDS_BY_NAME[sg.country]; if (!c) return;
            const col = lerpHex('#c9974a', '#3f9d6b', ind.chain.length > 1 ? i / (ind.chain.length - 1) : 0);
            drawNode(c, 11, col, '#0b0e13', String(i + 1));
          });
        } else {
          ind.players.slice().sort((a, b) => b.share - a.share).forEach((p, i) => {
            const c = CENTROIDS_BY_NAME[p.country]; if (!c) return;
            drawNode(c, 6 + p.share * 16, '#4aa8c9', '#dff2f8', String(i + 1));
          });
        }
      }

      // air traffic: great-circle flight paths + plane particles
      if (ov.air) {
        for (const [a, b] of FLIGHT_ROUTES) drawArcPts(a, b, 'rgba(176,200,224,0.7)', cx, cy, R, center, animate ? time : 0, animate);
      }

      // satellites: 5 orbital shells as lifted rings + moving dots (occlusion = only what the planet covers)
      if (ov.sat) {
        const shown = (ll: [number, number], p: [number, number]) => visible(ll) || Math.hypot(p[0] - cx, p[1] - cy) > R;
        const track = (o: typeof ORBITS[number], th: number): [number, number] => {
          const lat = Math.asin(Math.sin(o.inc) * Math.sin(th)) * 180 / Math.PI;
          const lon = o.node + Math.atan2(Math.cos(o.inc) * Math.sin(th), Math.cos(th)) * 180 / Math.PI;
          return [lon, lat];
        };
        for (const o of ORBITS) {
          ctx.beginPath(); let started = false;
          for (let k = 0; k <= 128; k++) {
            const ll = track(o, (k / 128) * 2 * Math.PI); const p = lift(ll, o.alt);
            if (p && shown(ll, p)) { if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]); } else started = false;
          }
          ctx.strokeStyle = o.color; ctx.lineWidth = 1; ctx.stroke();
          for (let s = 0; s < o.count; s++) {
            const ll = track(o, (animate ? time : 0) * o.speed + (s / o.count) * 2 * Math.PI);
            const p = lift(ll, o.alt);
            if (p && shown(ll, p)) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, Math.PI * 2); ctx.fillStyle = '#eaf4fb'; ctx.globalAlpha = 0.95; ctx.fill(); }
          }
          ctx.globalAlpha = 1;
        }
      }

      // meteorological: rotating storm spirals — live cyclones (real position, category-
      // scaled, with a near-term forecast track) when available, else the curated
      // decorative set. Spin follows the hemisphere (cyclonic: CCW north, CW south).
      if (ov.weather) {
        const live = storms.current;
        const list = live.length
          ? live.map((s) => ({ lon: s.lon, lat: s.lat, spin: s.lat >= 0 ? 1 : -1, size: 1 + s.category * 0.18, track: s.track }))
          : STORMS.map((s) => ({ lon: s.lon, lat: s.lat, spin: s.spin, size: 1, track: [] as [number, number][] }));
        list.forEach((s, si) => {
          const ll: [number, number] = [s.lon, s.lat]; if (!visible(ll)) return;
          const p = projection(ll); if (!p) return;
          if (s.track.length) {  // near-term forecast track (live storms only)
            ctx.beginPath(); let started = false;
            for (const tp of [[s.lon, s.lat] as [number, number], ...s.track]) {
              if (!visible(tp)) { started = false; continue; }
              const q = projection(tp); if (!q) { started = false; continue; }
              if (!started) { ctx.moveTo(q[0], q[1]); started = true; } else ctx.lineTo(q[0], q[1]);
            }
            ctx.strokeStyle = 'rgba(196,218,238,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate((animate ? time : 0) * 0.7 * s.spin + si);
          ctx.strokeStyle = 'rgba(196,218,238,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          for (let arm = 0; arm < 2; arm++) {
            ctx.beginPath();
            for (let a = 0; a <= 60; a++) { const ang = a / 60 * Math.PI * 2.4 + arm * Math.PI; const rr = (1.6 + a / 60 * 16) * s.size; const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(235,243,251,0.95)'; ctx.fill();
          ctx.restore();
        });
      }

      // meteorological: atmospheric field shell — a VOLUMETRIC cloud layer. The GPU path
      // (WebGL2) raymarches a thin cloud shell above the surface: coverage (where/how much)
      // from the interpolated field, volume (the form) from baked worley-perlin 3D noise,
      // sun-lit and standing over the limb. It degrades to the retained canvas-2D continuous
      // texture (interpolated field × noise) when WebGL2 is unavailable / context-lost, and
      // to sprite puffs beneath that. Ambient/decorative; renders nothing without live data.
      const fld = field.current;
      if (ov.weather && fld && fld.nlon > 0) {
        // GPU path: a WebGL2 raymarched volumetric shell, coverage from the field and
        // volume from baked noise, sun-lit, composited here (labels/storms stay above).
        // Re-raymarched only on camera/time/field change; the cached bitmap is redrawn
        // on idle frames. Degrades to the canvas-2D path when unavailable / context-lost.
        const useGpu = CLOUD_MODE === 'gpu' && cloudGL != null && cloudGL.ready && !cloudGL.lost;
        if (useGpu) {
          cloudGL!.setField(fld);
          const [slon, slat] = subSolarPoint(new Date());
          const tBucket = animate ? Math.floor(time * 12) : 0; // ~12 rebuilds/s when animating
          const key = `${rot.current.lambda.toFixed(2)}:${rot.current.phi.toFixed(2)}:${zoom.current.toFixed(3)}:${tBucket}:${fld.ts ?? ''}`;
          if (key !== cloudKey.current) {
            cloudKey.current = key;
            const bmp = cloudGL!.render({
              w, h, dpr, cx, cy, R, lambda: rot.current.lambda, phi: rot.current.phi,
              sunLon: slon, sunLat: slat, time, animate,
            });
            if (bmp) cloudBitmap.current = bmp;
          }
          if (cloudBitmap.current) {
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(cloudBitmap.current, 0, 0, w, h);
          }
        } else if (CLOUD_MODE !== 'off' && !CLOUD_CANVAS_SPRITES) {
          const TS = 112;
          const tex = cloudCanvas(TS);
          if (frame - tex.frame >= 3) {            // throttle rebuild (~20fps), cache between
            tex.frame = frame;
            if (!tex.img) tex.img = tex.g.createImageData(TS, TS);
            const data = tex.img.data;
            data.fill(0);
            const phase = animate ? time : 0;
            const inv = projection.invert;
            for (let j = 0; j < TS; j++) {
              const sy = cy - R + ((j + 0.5) / TS) * 2 * R;
              for (let i = 0; i < TS; i++) {
                const sx = cx - R + ((i + 0.5) / TS) * 2 * R;
                const rr = Math.hypot(sx - cx, sy - cy) / R;
                if (rr > 1) continue;              // outside the globe disc
                const ll = inv ? inv([sx, sy]) : null;
                if (!ll) continue;                 // far hemisphere / off-globe
                const cloud = sampleField(fld, ll[0], ll[1], 'cloud');
                if (cloud === null || cloud < 12) continue;
                const n = fbm(ll[0] * 0.05 + phase * 0.012, ll[1] * 0.05);
                const limb = rr > 0.9 ? Math.max(0, (1 - rr) / 0.1) : 1;
                const a = (cloud / 100) * (0.28 + 0.6 * n) * limb;
                if (a <= 0.02) continue;
                const p = sampleField(fld, ll[0], ll[1], 'precip') ?? 0;
                const dark = p > 0.4 ? 0.8 : 1;    // subtle rain emphasis
                const idx = (j * TS + i) * 4;
                data[idx] = 236 * dark; data[idx + 1] = 243 * dark; data[idx + 2] = 250 * dark;
                data[idx + 3] = Math.min(180, a * 255);
              }
            }
            tex.g.putImageData(tex.img, 0, 0);
          }
          ctx.globalAlpha = 1;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(tex.c, cx - R, cy - R, 2 * R, 2 * R);
        } else if (CLOUD_MODE !== 'off' && CLOUD_CANVAS_SPRITES) {
          // deepest fallback: soft sprite puffs sampled from the packed grid nodes
          const puff = cloudPuff();
          for (let jl = 0; jl < fld.nlat; jl++) for (let il = 0; il < fld.nlon; il++) {
            const cloud = fld.cloud[jl * fld.nlon + il];
            if (cloud === null || cloud < 22) continue;
            const ll: [number, number] = [-180 + il * fld.step, fld.latMin + jl * fld.step];
            if (!visible(ll)) continue;
            const pt = lift(ll, 1.035); if (!pt) continue;
            const r = scale * (0.10 + 0.055 * (cloud / 100));
            ctx.globalAlpha = Math.min(0.6, 0.08 + ((cloud - 22) / 78) * 0.52);
            ctx.drawImage(puff, pt[0] - r, pt[1] - r, r * 2, r * 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // meteorological: numeric value labels for the active mode with size-based
      // LOD. A country's label fades in only once its on-screen footprint is wide
      // enough to host the text, so smaller countries reveal their value as you zoom
      // in. Live data only, for the active mode's facet — labels are never shown for
      // the synthetic latitude fallback, nor in precip/wind mode without live data.
      if (ov.weather && weather.current.size) {
        const spec = MODE_META[wmode];
        const anom = wview === 'anomaly';
        const wx = weather.current;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        for (const f of COUNTRY_FEATURES) {
          const iso = isoForFeature(f);
          if (!iso) continue;
          const row = wx.get(iso);
          const v = anom ? (row ? row.z[wmode] : null) : (row ? spec.value(row) : null);
          if (v === null || v === undefined) continue;
          if (anom && !ANOM_META[wmode].diverging && v <= 0) continue; // one-sided low tail: no label
          const ll = LABEL_POINTS[iso] ?? (geoCentroid(f) as [number, number]);
          if (!visible(ll)) continue;
          const b = path.bounds(f); // on-screen bbox of the (near-hemisphere) country
          const bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
          if (!isFinite(bw) || !isFinite(bh) || bh < 12) continue; // need vertical room
          const alpha = Math.min(1, (bw - 20) / 16); // LOD: fade in over 20→36px width
          if (alpha < 0.05) continue;                // too small on screen — zoom to reveal
          const p = projection(ll);
          if (!p) continue;
          const label = anom ? fmtZ(v) : spec.fmt(v);
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = 'rgba(6,10,15,0.78)';
          ctx.strokeText(label, p[0], p[1]);
          ctx.fillStyle = '#eef4f9';
          ctx.fillText(label, p[0], p[1]);
        }
        ctx.globalAlpha = 1;
      }

      // selected outline
      if (sel) {
        const f = COUNTRY_FEATURES.find((x) => isoForFeature(x) === sel);
        if (f) { ctx.beginPath(); path(f); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6; ctx.stroke(); }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const featureAt = (clientX: number, clientY: number): Feature | null => {
      const rect = canvas.getBoundingClientRect();
      const pt = projection.invert?.([clientX - rect.left, clientY - rect.top]);
      if (!pt) return null;
      for (const f of COUNTRY_FEATURES) if (geoContains(f, pt)) return f;
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
      target.current = null;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (drag.current) {
        const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        drag.current.x = e.clientX; drag.current.y = e.clientY;
        const k = 0.28 / zoom.current;
        rot.current.lambda += dx * k;
        rot.current.phi = Math.max(-90, Math.min(90, rot.current.phi - dy * k));
        setHover(null);
        return;
      }
      const f = featureAt(e.clientX, e.clientY);
      if (f) {
        const iso = isoForFeature(f);
        const st = iso ? tileState().get(iso) ?? null : null;
        const rect = wrap.getBoundingClientRect();
        setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: featureName(f), state: st });
      } else setHover(null);
    };
    const onPointerUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (d && d.moved < 4) {
        const f = featureAt(e.clientX, e.clientY);
        if (f) { select(isoForFeature(f)); const c = geoCentroid(f); target.current = { lambda: -c[0], phi: -c[1] }; }
        else select(null);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = Math.max(0.7, Math.min(4, zoom.current * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    };
    const onLeave = () => setHover(null);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cloudGL?.dispose();
      if (cloudBitmap.current) { cloudBitmap.current.close(); cloudBitmap.current = null; }
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: hover ? 'pointer' : 'grab' }} />
      {hover && (
        <div style={{ position: 'absolute', left: hover.x + 14, top: hover.y + 14, pointerEvents: 'none', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 7, padding: '6px 9px', boxShadow: 'var(--sh-popup)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: hover.state && hover.state !== 'stale' ? stateColor(hover.state) : 'transparent', backgroundImage: hover.state === 'stale' ? 'repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)' : undefined, border: !hover.state || hover.state === 'stale' ? '1px solid var(--state-stale)' : undefined }} />
          <span style={{ fontSize: 12, color: 'var(--txt)' }}>{hover.name}</span>
          {hover.state && <span className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{stateLabel(hover.state)}</span>}
        </div>
      )}
    </div>
  );
}
