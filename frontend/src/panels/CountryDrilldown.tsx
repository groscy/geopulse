/*
 * Country drill-down — foundation rendering that brings tokens + fixtures
 * together (design-system verification task 18/19). Full live behavior
 * (sparklines from live series, active incidents, SSE) is M2 country-drilldown.
 */
import { Flag, Sparkline, StateDot, stateLabel, stateVar } from '../components/bits';
import type { CountryDetail, MetricRow } from '../data/types';
import { useAppActions } from '../state/store';

function ageText(min: number | null): string {
  if (min == null) return 'stale';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

/** One key-metric row (label, source·age, sparkline, value, trailing state dot). */
function MetricLine({ m }: { m: MetricRow }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line2)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--txt)' }}>{m.label}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>{m.source} · {ageText(m.ageMin)}</div>
      </div>
      <Sparkline series={m.series} state={m.state} />
      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 12.5, color: '#e7eef4' }}>{m.value}</div>
          {m.delta && <div className="mono" style={{ fontSize: 10.5, color: stateVar(m.state) }}>{m.delta}</div>}
        </div>
        <StateDot state={m.state} size={7} />
      </div>
    </div>
  );
}

export function CountryDrilldown({ c }: { c: CountryDetail }) {
  const { select, openModal } = useAppActions();
  const domains: { key: keyof CountryDetail['domains']; label: string }[] = [
    { key: 'economy', label: 'Economy' },
    { key: 'markets', label: 'Markets' },
    { key: 'relations', label: 'Relations' },
  ];

  return (
    <div style={{ padding: 'var(--pad-panel)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button onClick={() => select(null)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
        ← All incidents
      </button>

      {/* identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Flag iso2={c.iso2} w={30} h={22} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#e7eef4' }}>{c.name}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.region}</div>
        </div>
      </div>

      {/* composite banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 'var(--r-card)',
          background: `color-mix(in srgb, ${stateVar(c.composite)} 12%, var(--panel2))`,
          border: `1px solid color-mix(in srgb, ${stateVar(c.composite)} 40%, transparent)`,
        }}
      >
        <StateDot state={c.composite} glow size={11} />
        <div style={{ flex: 1 }}>
          <div className="section-label">Composite state</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: stateVar(c.composite) }}>{stateLabel(c.composite)}</div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.source} · {ageText(c.ageMin)}</div>
      </div>

      {/* domain chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {domains.map((d) => {
          const st = c.domains[d.key];
          return (
            <div key={d.key} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--panel2)', border: '1px solid var(--line2)' }}>
              <div className="section-label" style={{ marginBottom: 4 }}>{d.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StateDot state={st} />
                <span style={{ fontSize: 12, color: stateVar(st) }}>{stateLabel(st)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* key metrics */}
      <div>
        <div className="section-label" style={{ marginBottom: 6 }}>Key metrics</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {c.metrics.map((m) => <MetricLine key={m.key} m={m} />)}
        </div>
      </div>

      {/* news domain — standalone, informational; never feeds the composite */}
      <div>
        <div className="section-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>News</span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--txt3)', textTransform: 'none', letterSpacing: 0 }}>standalone · not in composite</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 11px',
            borderRadius: 'var(--r-card)',
            background: `color-mix(in srgb, ${stateVar(c.domains.news)} 9%, var(--panel2))`,
            border: `1px dashed color-mix(in srgb, ${stateVar(c.domains.news)} 40%, var(--line2))`,
            marginBottom: 8,
          }}
        >
          <StateDot state={c.domains.news} glow size={10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: stateVar(c.domains.news) }}>{stateLabel(c.domains.news)}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>Media climate · GDELT coverage</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {c.newsMetrics.map((m) => <MetricLine key={m.key} m={m} />)}
        </div>
      </div>

      {/* weather facets — standalone; scored & incident-driving, never in the composite */}
      {(c.weatherFacets?.length ?? 0) > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Weather</span>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--txt3)', textTransform: 'none', letterSpacing: 0 }}>standalone · not in composite</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {c.weatherFacets!.map((m) => <MetricLine key={m.key} m={m} />)}
          </div>
        </div>
      )}

      {/* top relations */}
      {c.relations.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Top relations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.relations.map((r) => (
              <div key={r.iso3} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 96 }}>
                  <Flag iso2={r.iso3.slice(0, 2).toLowerCase()} />
                  <span style={{ fontSize: 12, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                </div>
                <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, var(--tone-hostile), var(--tone-tense), var(--tone-warm))' }}>
                  <span style={{ position: 'absolute', top: -2, left: `calc(${((Math.max(-2, Math.min(2, r.tone)) + 2) / 4) * 100}% - 5px)`, width: 10, height: 10, borderRadius: '50%', background: '#e7eef4', border: '2px solid var(--panel)' }} />
                </div>
                <span className="mono" style={{ fontSize: 11.5, color: r.tone < 0 ? 'var(--tone-hostile)' : 'var(--tone-warm)', width: 34, textAlign: 'right' }}>
                  {r.tone > 0 ? '+' : ''}{r.tone.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* active incidents */}
      {c.incidents.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Active incidents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.incidents.map((inc) => (
              <button key={inc.id} onClick={() => openModal(inc.id)}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--line2)', cursor: 'pointer' }}>
                <StateDot state={inc.severity} glow />
                <span style={{ flex: 1, fontSize: 12, color: '#dfe7ee' }}>{inc.title}</span>
                {inc.metric && <span className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>{inc.metric}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* country stats */}
      {(c.stats.gdp || c.stats.population) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {([
            ['GDP', c.stats.gdp],
            ['GDP / capita', c.stats.gdpPerCapita],
            ['Happiness', c.stats.happiness ? `${c.stats.happiness}${c.stats.happinessRank ? ` · #${c.stats.happinessRank}` : ''}` : null],
            ['Population', c.stats.population],
          ] as const).map(([label, val]) => (
            <div key={label} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--panel2)', border: '1px solid var(--line2)' }}>
              <div className="section-label" style={{ marginBottom: 3 }}>{label}</div>
              <div className="mono" style={{ fontSize: 12.5, color: val ? '#e7eef4' : 'var(--txt3)' }}>{val ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
