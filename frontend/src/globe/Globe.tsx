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
import { RELATION_ARCS } from '../data/fixtures';
import { INDUSTRIES, FLIGHT_ROUTES, ORBITS, STORMS } from '../data/overlays';
import { useLive } from '../data/live';
import { useAppActions, useAppState } from '../state/store';
import type { HealthMetric } from '../state/types';
import { IDLE_ROTATION_DEG_PER_FRAME, shouldAnimate } from '../state/motion';
import { lerpHex, stateColor, toneColor, type HealthState } from '../theme/colors';
import { staleHatchPattern } from '../theme/patterns';
import { stateLabel } from '../components/bits';
import { COUNTRY_FEATURES, BORDERS, CENTROIDS, CENTROIDS_BY_NAME, featureName, isoForFeature } from './geo';

const TEMP_STOPS: [number, string][] = [
  [-12, '#3f6fc4'], [4, '#4aa8c9'], [17, '#57ab73'], [25, '#cbb043'], [33, '#d1863f'], [42, '#cc5b52'],
];
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
function tempColor(lat: number, seed: number): string {
  const temp = 31 - Math.abs(lat) * 0.72 + (hash(seed) - 0.5) * 9;
  if (temp <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    if (temp <= TEMP_STOPS[i][0]) return lerpHex(TEMP_STOPS[i - 1][1], TEMP_STOPS[i][1], (temp - TEMP_STOPS[i - 1][0]) / (TEMP_STOPS[i][0] - TEMP_STOPS[i - 1][0]));
  }
  return TEMP_STOPS[TEMP_STOPS.length - 1][1];
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
  const { selected, autoRotate, reduceMotion, overlays, domain, industry, indView } = useAppState();
  const { select } = useAppActions();
  const [hover, setHover] = useState<Hover | null>(null);

  const rot = useRef<Rotation>({ lambda: 0, phi: -16 });
  const zoom = useRef(1);
  const target = useRef<Rotation | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const arcs = useRef<Arc[]>(RELATION_ARCS);
  const selDomainState = useRef<HealthState | null>(null);

  const live = useRef({ tiles, selected, autoRotate, reduceMotion, overlays, domain, industry, indView });
  live.current = { tiles, selected, autoRotate, reduceMotion, overlays, domain, industry, indView };

  // arcs: from the API (or fixtures)
  useEffect(() => {
    if (!API_BASE) { arcs.current = RELATION_ARCS; return; }
    let alive = true;
    const load = () => fetch(`${API_BASE}/api/arcs`).then((r) => r.json()).then((a: Arc[]) => { if (alive) arcs.current = a; }).catch(() => {});
    load();
    const id = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // selected country's chosen-domain state (Health single-select coloring)
  useEffect(() => {
    if (!selected || domain === 'composite') { selDomainState.current = null; return; }
    let alive = true;
    const key: Record<HealthMetric, 'economy' | 'markets' | 'relations' | null> = {
      composite: null, economy: 'economy', markets: 'markets', conflict: null,
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
      const { selected: sel, autoRotate: auto, reduceMotion: rm, overlays: ov, domain: dom } = live.current;
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

      // meteorological: temperature choropleth (tint land), alpha .58
      if (ov.weather) {
        ctx.globalAlpha = 0.58;
        for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
          const f = COUNTRY_FEATURES[i];
          const c = CENTROIDS[isoForFeature(f) ?? ''] ?? (geoCentroid(f) as [number, number]);
          ctx.beginPath(); path(f); ctx.fillStyle = tempColor(c[1], i); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // borders
      ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(9,13,17,0.85)'; ctx.lineWidth = 0.55; ctx.stroke();

      // day / night: terminator via geoCircle at the anti-solar point + meridians (no sun marker)
      if (ov.sun) {
        const now = new Date();
        const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
        let slon = ((-(utcH - 12) * 15) + 540) % 360 - 180;
        const dayOfYear = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000;
        const slat = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
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

      // meteorological: rotating storm spirals
      if (ov.weather) {
        STORMS.forEach((s, si) => {
          const ll: [number, number] = [s.lon, s.lat]; if (!visible(ll)) return;
          const p = projection(ll); if (!p) return;
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate((animate ? time : 0) * 0.7 * s.spin + si);
          ctx.strokeStyle = 'rgba(196,218,238,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          for (let arm = 0; arm < 2; arm++) {
            ctx.beginPath();
            for (let a = 0; a <= 60; a++) { const ang = a / 60 * Math.PI * 2.4 + arm * Math.PI; const rr = 1.6 + a / 60 * 16; const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(235,243,251,0.95)'; ctx.fill();
          ctx.restore();
        });
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
