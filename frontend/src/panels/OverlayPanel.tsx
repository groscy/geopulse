/*
 * Per-overlay right panels — capability: extended-overlays (3.4, 4.3, 5.3, 6.3, 7.3).
 * Shown by the focus rule when an overlay owns the panel and nothing is selected.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useAppActions, useAppState } from '../state/store';
import type { OverlayId } from '../state/types';
import {
  CORRIDORS, FLIGHT_ROUTES, INDUSTRIES, SAT_SHELLS, SAT_TOTAL, STORMS, ZONES,
} from '../data/overlays';
import { fetchWeather, fetchStorms } from '../data/apiSource';
import { ANOM_META, MODE_META, MODES } from '../data/weather';
import type { StormFeature, WeatherRow } from '../data/types';
import { stateVar } from '../components/bits';

function Label({ children }: { children: ReactNode }) {
  return <div className="section-label" style={{ margin: '4px 0 6px' }}>{children}</div>;
}
const wrap = { padding: 'var(--pad-panel)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 } as const;
const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line2)' } as const;

function Industries() {
  const { industry, indView } = useAppState();
  const { setIndustry, setIndView } = useAppActions();
  const ind = INDUSTRIES.find((i) => i.id === industry) ?? INDUSTRIES[0];
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Industries</div>
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Key players &amp; global value chains</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {INDUSTRIES.map((i) => (
          <button key={i.id} className={`chip${i.id === ind.id ? ' on' : ''}`} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => setIndustry(i.id)}>{i.name}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['players', 'chain'] as const).map((v) => (
          <button key={v} className={`chip${indView === v ? ' on' : ''}`} style={{ flex: 1, padding: '5px 0', fontSize: 11.5 }} onClick={() => setIndView(v)}>
            {v === 'players' ? 'Key players' : 'Supply chain'}
          </button>
        ))}
      </div>
      {indView === 'players' ? (
        <div>
          <Label>Value share</Label>
          {ind.players.slice().sort((a, b) => b.share - a.share).map((p, i) => (
            <div key={p.country} style={{ padding: '5px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--txt)' }}><span className="mono" style={{ color: 'var(--txt3)', marginRight: 6 }}>{i + 1}</span>{p.country}</span>
                <span className="mono" style={{ color: '#4aa8c9' }}>{Math.round(p.share * 100)}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--panel2)' }}>
                <div style={{ height: '100%', width: `${Math.min(100, p.share * 100)}%`, borderRadius: 3, background: '#4aa8c9' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2 }}>{p.role}</div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <Label>Stages · extraction → market</Label>
          {ind.chain.map((s, i) => (
            <div key={s.country} style={{ display: 'flex', gap: 9, padding: '6px 0', alignItems: 'flex-start' }}>
              <span className="mono" style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--panel2)', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--txt2)', flex: '0 0 auto' }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--txt)' }}>{s.country}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt3)' }}>{s.stage} · {s.role}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AirTraffic() {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Air traffic</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{FLIGHT_ROUTES.length} active corridors</div>
      <Label>Busiest corridors</Label>
      {CORRIDORS.map((c) => (
        <div key={c.n} style={row}>
          <span style={{ fontSize: 12, color: 'var(--txt)' }}>{c.n}</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--txt3)' }}>{c.r}</span>
        </div>
      ))}
    </div>
  );
}

function Satellites() {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Satellites</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>{SAT_TOTAL} tracked across {SAT_SHELLS.length} shells</div>
      <Label>Constellations</Label>
      {SAT_SHELLS.map((s) => (
        <div key={s.n} style={row}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--txt)' }}>{s.n}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>{s.alt}</div>
          </div>
          <span className="mono" style={{ fontSize: 12, color: '#eaf4fb' }}>{s.count}</span>
        </div>
      ))}
    </div>
  );
}

function ValRow({ country, value }: { country: string; value: string }) {
  return (
    <div style={row}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--txt)' }}>{country}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--txt2)' }}>{value}</span>
    </div>
  );
}

// per-mode ranked-list heading noun (temperature is two-sided, so it also lists coldest)
const TOP_LABEL: Record<string, string> = { temp: 'warmest', precip: 'wettest', wind: 'windiest' };

function Weather() {
  const { weatherMode, weatherView } = useAppState();
  const { setWeatherMode, setWeatherView } = useAppActions();
  const [rows, setRows] = useState<WeatherRow[]>([]);
  const [storms, setStorms] = useState<StormFeature[]>([]);
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE as string | undefined;
    if (!base) return; // fixtures/demo: no live weather, show storms + legend only
    let alive = true;
    // one fetch holds all three facets; switching mode never refetches.
    fetchWeather(base).then((d) => { if (alive) setRows(d); }).catch(() => {});
    fetchStorms(base).then((s) => { if (alive) setStorms(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // live active cyclones when available, else the curated decorative set
  const stormList = storms.length
    ? storms.map((s) => ({ key: s.id, name: s.name, cat: s.categoryLabel }))
    : STORMS.map((s) => ({ key: s.name, name: s.name, cat: s.cat }));

  const spec = MODE_META[weatherMode];
  const live = rows.filter((r) => spec.value(r) !== null);
  const sorted = [...live].sort((a, b) => (spec.value(b) as number) - (spec.value(a) as number));
  const top = sorted.slice(0, 3);
  const coldest = weatherMode === 'temp' ? sorted.slice(-3).reverse() : [];
  const anomalies = live.filter((r) => spec.state(r) === 'degraded' || spec.state(r) === 'disrupted');

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Meteorological</div>
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{spec.desc} &amp; active storm systems</div>

      <div style={{ display: 'flex', gap: 6 }}>
        {MODES.map((m) => (
          <button key={m} className={`chip${weatherMode === m ? ' on' : ''}`} style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={() => setWeatherMode(m)}>
            {MODE_META[m].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['value', 'anomaly'] as const).map((v) => (
          <button key={v} className={`chip${weatherView === v ? ' on' : ''}`} style={{ flex: 1, padding: '4px 0', fontSize: 10.5 }} onClick={() => setWeatherView(v)}>
            {v === 'value' ? 'Value' : 'Anomaly'}
          </button>
        ))}
      </div>

      {live.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--txt3)' }}>{live.length} countries reporting</div>
          <Label>{spec.aggLabel} · {TOP_LABEL[weatherMode]}</Label>
          {top.map((r) => <ValRow key={r.country} country={r.country} value={spec.fmt(spec.value(r) as number)} />)}
          {coldest.length > 0 && (
            <>
              <Label>{spec.aggLabel} · coldest</Label>
              {coldest.map((r) => <ValRow key={r.country} country={r.country} value={spec.fmt(spec.value(r) as number)} />)}
            </>
          )}
          {anomalies.length > 0 && (
            <>
              <Label>Anomalies</Label>
              {anomalies.slice(0, 6).map((r) => (
                <div key={r.country} style={row}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--txt)' }}>{r.country}</span>
                  <span className="mono" style={{ fontSize: 11, color: stateVar(spec.state(r)) }}>{spec.state(r)} · {spec.fmt(spec.value(r) as number)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <Label>Active storm systems</Label>
      {stormList.map((s) => (
        <div key={s.key} style={row}>
          <span style={{ fontSize: 12, color: 'var(--txt)' }}>{s.name}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--state-degraded)' }}>{s.cat}</span>
        </div>
      ))}
      <Label>{weatherView === 'anomaly' ? `${spec.label} · anomaly` : spec.label}</Label>
      <div style={{ height: 6, borderRadius: 3, background: (weatherView === 'anomaly' ? ANOM_META[weatherMode].legend : spec.legend).css }} />
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--txt3)' }}>
        <span>{(weatherView === 'anomaly' ? ANOM_META[weatherMode].legend : spec.legend).lo}</span>
        <span>{(weatherView === 'anomaly' ? ANOM_META[weatherMode].legend : spec.legend).hi}</span>
      </div>

      <Label>Atmosphere · cloud cover</Label>
      <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(90deg,rgba(224,234,246,0),rgba(236,243,250,0.95))' }} />
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--txt3)' }}><span>clear</span><span>overcast</span></div>
    </div>
  );
}

function DayNight() {
  const now = new Date();
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const utcH = utcMin / 60;
  const slon = ((-(utcH - 12) * 15) + 540) % 360 - 180;
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Day / night</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>Subsolar point ≈ {slon.toFixed(0)}° lon</div>
      <Label>Local time</Label>
      {ZONES.map(([city, label, off]) => {
        let m = (utcMin + off * 60) % 1440; if (m < 0) m += 1440;
        const hh = Math.floor(m / 60), mm = Math.round(m % 60);
        const isDay = hh >= 6 && hh < 18;
        return (
          <div key={city} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isDay ? '#d9b84a' : '#3f6fc4' }} />
              <span style={{ fontSize: 12, color: 'var(--txt)' }}>{city}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>{label}</span>
            </span>
            <span className="mono" style={{ fontSize: 12, color: '#e7eef4' }}>{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}</span>
          </div>
        );
      })}
      <div className="mono" style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>Thin meridians = 1-hour zones</div>
    </div>
  );
}

export function OverlayPanel({ id }: { id: OverlayId }) {
  switch (id) {
    case 'industry': return <Industries />;
    case 'air': return <AirTraffic />;
    case 'sat': return <Satellites />;
    case 'weather': return <Weather />;
    case 'sun': return <DayNight />;
    default: return null;
  }
}
