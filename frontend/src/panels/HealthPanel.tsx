/*
 * Global health panel — capability: app-shell (focus rule).
 * RightPanel shows this when a non-composite Health metric is selected and no
 * country is picked: a worldwide state breakdown for that metric plus a ranked
 * list of the most-affected countries. A row selects that country (-> drilldown).
 * (Composite keeps the Global incidents feed as its global view.)
 *
 * Data comes from GET /api/domain-tiles (per-domain committed states); it degrades
 * to an empty state when the backend predates that endpoint, never crashing.
 */
import { StateDot, stateLabel, stateVar } from '../components/bits';
import { useDomainTiles } from '../data/useData';
import { useAppActions } from '../state/store';
import type { DomainKey, HealthState } from '../data/types';
import type { HealthMetric } from '../state/types';

const META: Record<HealthMetric, { title: string; desc: string }> = {
  composite: { title: 'Composite', desc: 'Overall country risk state' },
  economy: { title: 'Economy', desc: 'Macro · inflation, growth, debt' },
  markets: { title: 'Markets', desc: 'Equity indices & FX' },
  conflict: { title: 'Conflict', desc: 'Diplomatic relations · GDELT tone' },
  news: { title: 'News', desc: 'Media climate · GDELT coverage' },
};

// UI Health metric -> the score domain that backs it (conflict == relations).
const DOMAIN_KEY: Record<HealthMetric, DomainKey> = {
  composite: 'composite', economy: 'economy', markets: 'markets', conflict: 'relations', news: 'news',
};

// worst-first ordering; stale (no data) sorts last.
const ORDER: HealthState[] = ['disrupted', 'degraded', 'operational', 'stale'];
const RANK: Record<HealthState, number> = { disrupted: 0, degraded: 1, operational: 2, stale: 3 };

const wrap = { padding: 'var(--pad-panel)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 } as const;

export function HealthPanel({ domain }: { domain: HealthMetric }) {
  const rows = useDomainTiles(DOMAIN_KEY[domain]);
  const { select } = useAppActions();
  const meta = META[domain];

  const counts = ORDER.reduce((acc, s) => ((acc[s] = 0), acc), {} as Record<HealthState, number>);
  for (const r of rows) counts[r.state] += 1;
  const reporting = rows.length - counts.stale;
  const affected = rows
    .filter((r) => r.state === 'disrupted' || r.state === 'degraded')
    .sort((a, b) => RANK[a.state] - RANK[b.state] || a.name.localeCompare(b.name));

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>{meta.title}</div>
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{meta.desc}</div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--txt3)' }}>
        {reporting} of {rows.length} countries scored
      </div>

      {/* worldwide state distribution */}
      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--panel2)' }}>
            {ORDER.map((s) => (counts[s] > 0 ? (
              <div key={s} title={`${stateLabel(s)}: ${counts[s]}`}
                style={{ width: `${(counts[s] / rows.length) * 100}%`, background: stateVar(s) }} />
            ) : null))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--txt3)' }}>
                <StateDot state={s} size={7} /> {stateLabel(s)} <span className="mono" style={{ color: 'var(--txt2)' }}>{counts[s]}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* ranked most-affected — click selects the country's drilldown */}
      <div className="section-label" style={{ margin: '4px 0 2px' }}>Most affected</div>
      {affected.length === 0 ? (
        <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)', padding: '4px 2px' }}>
          {rows.length === 0 ? 'No countries scored for this metric yet.' : 'All reporting countries operational.'}
        </div>
      ) : (
        <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column' }}>
          {affected.map((r) => (
            <button key={r.iso3} onClick={() => select(r.iso3)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '7px 0', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'none', border: 'none', borderBottom: '1px solid var(--line2)',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <StateDot state={r.state} />
                <span style={{ fontSize: 12, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: stateVar(r.state), flex: '0 0 auto' }}>{stateLabel(r.state)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
