/*
 * Per-overlay right panels — capability: extended-overlays (3.4, 4.3, 5.3, 6.3, 7.3).
 * Shown by the focus rule when an overlay owns the panel and nothing is selected.
 */
import type { ReactNode } from 'react';
import { useAppActions, useAppState } from '../state/store';
import type { OverlayId } from '../state/types';
import {
  CORRIDORS, FLIGHT_ROUTES, INDUSTRIES, SAT_SHELLS, SAT_TOTAL, STORMS, ZONES,
} from '../data/overlays';

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

function Weather() {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#dfe7ee' }}>Meteorological</div>
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Surface temperature &amp; active storm systems</div>
      <Label>Active storm systems</Label>
      {STORMS.map((s) => (
        <div key={s.name} style={row}>
          <span style={{ fontSize: 12, color: 'var(--txt)' }}>{s.name}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--state-degraded)' }}>{s.cat}</span>
        </div>
      ))}
      <Label>Temperature</Label>
      <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#3f6fc4,#4aa8c9,#57ab73,#cbb043,#d1863f,#cc5b52)' }} />
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--txt3)' }}><span>−10°C</span><span>42°C</span></div>
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
