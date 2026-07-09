/*
 * Global incident feed — capability: incident-feed (tasks 6.1, 6.2).
 * Real incident cards from the live store: severity dot, title, affected flags,
 * triggering metric, since-time, status badge. Card click selects the incident's
 * country (drill-down); the chart icon opens the detail modal.
 */
import { Flag, StateDot } from '../components/bits';
import { useLive } from '../data/live';
import { useAppActions, useAppState } from '../state/store';
import type { FeedFilter } from '../state/types';

const FILTERS: FeedFilter[] = ['all', 'ongoing', 'resolved'];

function sinceText(iso: string): string {
  if (!iso || iso === 'fixture') return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `since ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 2 4-6" />
    </svg>
  );
}

export function IncidentFeed() {
  const { feedFilter } = useAppState();
  const { setFeedFilter, select, openModal } = useAppActions();
  const { incidents } = useLive();

  const ongoing = incidents.filter((i) => i.status === 'ongoing');
  const shown = incidents.filter((i) => (feedFilter === 'all' ? true : i.status === feedFilter));

  return (
    <div style={{ padding: 'var(--pad-panel)', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Global incidents</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{ongoing.length} active</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip${feedFilter === f ? ' on' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11.5, textTransform: 'capitalize' }} onClick={() => setFeedFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 2px' }}>No {feedFilter === 'all' ? '' : feedFilter} incidents.</div>
        )}
        {shown.map((inc) => (
          <div key={inc.id} className="gp-slide" onClick={() => select(inc.countries[0] ?? null)}
            style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '10px 11px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--line2)', cursor: 'pointer', boxShadow: 'var(--sh-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <StateDot state={inc.severity} glow />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#dfe7ee' }}>{inc.title}</span>
              {inc.hasChart && (
                <button title="Open chart" onClick={(e) => { e.stopPropagation(); openModal(inc.id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <ChartIcon />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {inc.countries.map((c) => <Flag key={c} iso2={c.slice(0, 2).toLowerCase()} w={18} h={13} />)}
              {inc.metric && <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt2)' }}>{inc.metric} · {inc.threshold}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt3)' }}>{sinceText(inc.startedAt)}</span>
              <span className="mono" style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 5, textTransform: 'capitalize',
                color: inc.status === 'ongoing' ? 'var(--state-degraded)' : 'var(--state-operational)',
                background: `color-mix(in srgb, ${inc.status === 'ongoing' ? 'var(--state-degraded)' : 'var(--state-operational)'} 14%, transparent)`,
              }}>{inc.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
