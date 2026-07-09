/*
 * Incident detail modal — capability: incident-feed (task 6.3).
 * Fetches the incident detail and draws an SVG threshold chart: the metric
 * series (area + line), a dashed threshold line at the breaching z level, a
 * breach marker where the series crosses, and axis ticks; plus current-z /
 * baseline μ±σ / affected stat cards and an explanatory paragraph.
 */
import { useEffect, useState } from 'react';
import { dataSource } from '../data/source';
import type { IncidentDetail } from '../data/types';
import { useAppActions, useAppState } from '../state/store';
import { StateDot, stateLabel, stateVar } from '../components/bits';

const W = 560, H = 240, PADL = 46, PADR = 14, PADT = 16, PADB = 26;

function Chart({ d }: { d: NonNullable<IncidentDetail['detail']> }) {
  const s = d.series ?? [];
  if (s.length < 2) return <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>No series for this incident.</div>;
  const mean = d.mean ?? 0, std = d.std ?? 1, z = d.z ?? 0, tz = d.threshold_z ?? 1;
  const thr = mean + Math.sign(z || -1) * tz * std;
  const ys = [...s, thr];
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = (i: number) => PADL + (i / (s.length - 1)) * (W - PADL - PADR);
  const y = (v: number) => PADT + (1 - (v - min) / span) * (H - PADT - PADB);
  const worse = (v: number) => (z < 0 ? v <= thr : v >= thr);
  let breach = s.findIndex(worse);
  if (breach < 1) breach = s.length - 1;

  const line = s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${PADL},${y(min)} ${line} ${x(s.length - 1)},${y(min)}`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * span);
  const col = stateVar(d.state ?? 'degraded');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="inc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.28" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((v, i) => (
        <g key={i}>
          <line x1={PADL} y1={y(v)} x2={W - PADR} y2={y(v)} stroke="var(--line2)" strokeWidth="1" />
          <text x={PADL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--txt3)" fontFamily="var(--font-mono)">{v.toFixed(1)}</text>
        </g>
      ))}
      <polygon points={area} fill="url(#inc-area)" />
      <polyline points={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
      {/* threshold line */}
      <line x1={PADL} y1={y(thr)} x2={W - PADR} y2={y(thr)} stroke="var(--state-disrupted)" strokeWidth="1.4" strokeDasharray="5 4" />
      <text x={W - PADR} y={y(thr) - 4} textAnchor="end" fontSize="9" fill="var(--state-disrupted)" fontFamily="var(--font-mono)">
        {d.state} threshold · |z| {tz.toFixed(1)}
      </text>
      {/* breach marker */}
      <line x1={x(breach)} y1={y(s[breach])} x2={x(breach)} y2={H - PADB} stroke="var(--state-disrupted)" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx={x(breach)} cy={y(s[breach])} r="4" fill="var(--state-disrupted)" />
      <text x={x(breach)} y={y(s[breach]) - 8} textAnchor="middle" fontSize="9" fill="var(--txt2)" fontFamily="var(--font-mono)">breach</text>
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: '9px 11px', borderRadius: 8, background: 'var(--panel2)', border: '1px solid var(--line2)' }}>
      <div className="section-label" style={{ marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: 13, color: '#e7eef4' }}>{value}</div>
    </div>
  );
}

export function IncidentModal() {
  const { modal } = useAppState();
  const { closeModal } = useAppActions();
  const [inc, setInc] = useState<IncidentDetail | null>(null);

  useEffect(() => {
    if (!modal) { setInc(null); return; }
    let alive = true;
    dataSource.incident(modal).then((r) => { if (alive) setInc(r); });
    return () => { alive = false; };
  }, [modal]);

  if (!modal) return null;
  const d = inc?.detail ?? null;

  return (
    <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(6,9,12,.66)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center' }}>
      <div className="gp-modal-enter" onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxWidth: '92vw', padding: 20, borderRadius: 'var(--r-modal)', background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--sh-modal)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <StateDot state={inc?.severity ?? 'degraded'} glow />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#e7eef4' }}>{inc?.title ?? 'Incident'}</div>
          {inc && <span className="mono" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, textTransform: 'capitalize', color: inc.status === 'ongoing' ? 'var(--state-degraded)' : 'var(--state-operational)', background: `color-mix(in srgb, ${inc.status === 'ongoing' ? 'var(--state-degraded)' : 'var(--state-operational)'} 14%, transparent)` }}>{inc.status}</span>}
          <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--txt3)', marginBottom: 12 }}>
          {inc?.metric ? `${inc.metric} · ` : ''}enters at |z| {d?.threshold_z?.toFixed(1) ?? '1.0'}, recovers below |z| 0.7 (hysteresis, 3-eval hold)
        </div>

        {d ? <Chart d={d} /> : <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)', padding: '20px 0' }}>Loading…</div>}

        {d && (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <StatCard label="Current z-score" value={(d.z ?? 0).toFixed(2)} />
              <StatCard label="90d baseline μ±σ" value={`${(d.mean ?? 0).toFixed(2)} ± ${(d.std ?? 0).toFixed(2)}`} />
              <StatCard label="Affected" value={d.country ?? (inc?.countries[0] ?? '—')} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
              {d.metric} crossed its {stateLabel(d.state ?? 'degraded')} threshold at z {(d.z ?? 0).toFixed(2)} against the
              country's own 90-day baseline. The state committed only after holding for 3 consecutive evaluations, and will
              recover once |z| falls below 0.7 — the hysteresis band that keeps the map from flapping.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
