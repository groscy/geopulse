/*
 * Top bar — capability: app-shell (task 2.2). Logo/title (home on click),
 * center summary counts (dot + mono number + label), right freshness + UTC clock.
 */
import { useLive } from '../data/live';
import { useAppActions, useAppState } from '../state/store';
import type { HealthState } from '../theme/colors';
import { stateVar } from '../components/bits';

const COUNT_ORDER: { state: HealthState; label: string }[] = [
  { state: 'operational', label: 'operational' },
  { state: 'degraded', label: 'degraded' },
  { state: 'disrupted', label: 'disrupted' },
  { state: 'stale', label: 'stale' },
];

function Count({ state, label, n }: { state: HealthState; label: string; n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: state === 'stale' ? 'transparent' : stateVar(state),
          backgroundImage: state === 'stale' ? 'repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)' : undefined,
          border: state === 'stale' ? '1px solid var(--state-stale)' : undefined,
        }}
      />
      <span className="mono" style={{ color: '#e7eef4', fontWeight: 500 }}>{n}</span>
      <span style={{ color: 'var(--txt3)' }}>{label}</span>
    </span>
  );
}

export function TopBar() {
  const { now, freshAgo } = useAppState();
  const { setView, select, closeModal } = useAppActions();
  const { tiles } = useLive();

  const counts = COUNT_ORDER.map(({ state, label }) => ({
    state,
    label,
    n: tiles.filter((t) => t.state === state).length,
  }));

  const goHome = () => {
    setView('dashboard');
    select(null);
    closeModal();
  };

  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 14px',
        background: 'var(--panel2)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* left: logo + title */}
      <button onClick={goHome} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ position: 'relative', width: 22, height: 22, borderRadius: 6, background: 'var(--em)', display: 'inline-block' }}>
          <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#eafff2', boxShadow: '0 0 8px 2px rgba(234,255,242,.7)' }} />
        </span>
        <span style={{ fontSize: 'var(--fs-product)', fontWeight: 700, color: '#e7eef4' }}>GeoPulse</span>
        <span style={{ color: 'var(--txt3)', fontSize: 11 }}>planetary status</span>
      </button>

      {/* center: summary counts */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, fontSize: 12 }}>
        {counts.map((c, i) => (
          <span key={c.state} style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            {i > 0 && <span style={{ width: 1, height: 14, background: 'var(--line)' }} />}
            <Count {...c} />
          </span>
        ))}
      </div>

      {/* right: freshness + UTC clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--txt2)' }}>
          <span className="gp-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--em)', boxShadow: '0 0 8px 1px color-mix(in srgb, var(--em) 60%, transparent)' }} />
          Live · updated <span className="mono">{freshAgo}s</span> ago
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
        <span className="mono" style={{ color: '#e7eef4', fontSize: 13 }}>{now}</span>
        <span style={{ color: 'var(--txt3)', fontSize: 10, letterSpacing: '.08em' }}>UTC</span>
      </div>
    </header>
  );
}
