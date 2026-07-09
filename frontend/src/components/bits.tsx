/*
 * Small shared presentational bits used across panels — capability: design-tokens.
 * All colors come from CSS variables so they follow the accent/token system.
 */
import type { CSSProperties } from 'react';
import type { HealthState } from '../theme/colors';

/** Map a health state to its CSS variable color. */
export function stateVar(state: HealthState): string {
  switch (state) {
    case 'operational':
      return 'var(--state-operational)';
    case 'degraded':
      return 'var(--state-degraded)';
    case 'disrupted':
      return 'var(--state-disrupted)';
    case 'stale':
      return 'var(--state-stale)';
  }
}

export function stateLabel(state: HealthState): string {
  return state[0].toUpperCase() + state.slice(1);
}

export function StateDot({ state, glow = false, size = 8 }: { state: HealthState; glow?: boolean; size?: number }) {
  const color = stateVar(state);
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: state === 'stale' ? 'transparent' : color,
    display: 'inline-block',
    flex: '0 0 auto',
    boxShadow: glow && state !== 'stale' ? `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)` : undefined,
    backgroundImage:
      state === 'stale'
        ? 'repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)'
        : undefined,
    border: state === 'stale' ? '1px solid var(--state-stale)' : undefined,
  };
  return <span style={style} aria-hidden="true" />;
}

/** Tiny SVG sparkline in the metric's state color. Empty series => a dim dash. */
export function Sparkline({ series, state, w = 72, h = 20 }: { series: number[]; state: HealthState; w?: number; h?: number }) {
  if (!series.length) {
    return (
      <svg width={w} height={h} aria-hidden="true">
        <line x1={2} y1={h / 2} x2={w - 2} y2={h / 2} stroke="var(--state-stale)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      </svg>
    );
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pad = 2;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={stateVar(state)} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Flag placeholder — local-first (NFR-1): no external image fetch. Shows the
 * ISO-2 code on a small rounded chip. Production self-hosts real flag imagery.
 */
export function Flag({ iso2, w = 22, h = 16 }: { iso2: string; w?: number; h?: number }) {
  return (
    <span
      className="mono"
      style={{
        width: w,
        height: h,
        borderRadius: 3,
        background: 'var(--panel2)',
        border: '1px solid var(--line)',
        color: 'var(--txt2)',
        fontSize: 8.5,
        fontWeight: 600,
        letterSpacing: '.04em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textTransform: 'uppercase',
        flex: '0 0 auto',
      }}
      title={iso2.toUpperCase()}
    >
      {iso2}
    </span>
  );
}
