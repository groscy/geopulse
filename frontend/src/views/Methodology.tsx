/*
 * Methodology page — capability: methodology-page (M3, R-3 launch blocker).
 * Full disclosure: z-score bands, worst-of composite, hysteresis, staleness.
 * Band values mirror the scoring-engine config (common/config.py) — keep in sync.
 */
import type { ReactNode } from 'react';
import { useAppActions } from '../state/store';
import { StateDot, stateVar } from '../components/bits';
import type { HealthState } from '../theme/colors';

// mirrors common/config.py (ENTER_DEGRADED / ENTER_DISRUPTED / RECOVER_DEGRADED / HYSTERESIS_N)
const BANDS = { degraded: 1.0, disrupted: 2.0, recover: 0.7, N: 3, baselineDays: 90 };

function ZDiagram() {
  const W = 620, H = 96, pad = 20, zmax = 3;
  const x = (z: number) => pad + ((z + zmax) / (2 * zmax)) * (W - 2 * pad);
  const bands: { from: number; to: number; state: HealthState }[] = [
    { from: -zmax, to: -BANDS.disrupted, state: 'disrupted' },
    { from: -BANDS.disrupted, to: -BANDS.degraded, state: 'degraded' },
    { from: -BANDS.degraded, to: BANDS.degraded, state: 'operational' },
    { from: BANDS.degraded, to: BANDS.disrupted, state: 'degraded' },
    { from: BANDS.disrupted, to: zmax, state: 'disrupted' },
  ];
  const sample = -1.6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 10 }}>
      {bands.map((b, i) => (
        <rect key={i} x={x(b.from)} y={30} width={x(b.to) - x(b.from)} height={16} fill={stateVar(b.state)} opacity={0.55} />
      ))}
      {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
        <g key={z}>
          <line x1={x(z)} y1={28} x2={x(z)} y2={48} stroke="var(--line)" strokeWidth="1" />
          <text x={x(z)} y={62} textAnchor="middle" fontSize="10" fill="var(--txt3)" fontFamily="var(--font-mono)">{z > 0 ? `+${z}` : z}</text>
        </g>
      ))}
      {/* sample marker */}
      <polygon points={`${x(sample)},24 ${x(sample) - 5},14 ${x(sample) + 5},14`} fill="#e7eef4" />
      <text x={x(sample)} y={10} textAnchor="middle" fontSize="9" fill="var(--txt2)" fontFamily="var(--font-mono)">z {sample}</text>
      <text x={x(0)} y={84} textAnchor="middle" fontSize="10" fill="var(--txt3)">|z| &lt; 1 operational · 1–2 degraded · ≥ 2 disrupted (symmetric)</text>
    </svg>
  );
}

function CompositeExample({ name, domains, worst, result }: { name: string; domains: [string, HealthState][]; worst: string; result: HealthState }) {
  return (
    <div style={{ padding: 12, borderRadius: 9, background: 'var(--panel2)', border: '1px solid var(--line2)', flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e7eef4', marginBottom: 8 }}>{name} → <span style={{ color: stateVar(result), textTransform: 'capitalize' }}>{result}</span></div>
      {domains.map(([d, s]) => (
        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <StateDot state={s} />
          <span style={{ fontSize: 12, color: 'var(--txt2)', textTransform: 'capitalize', flex: 1 }}>{d}</span>
          <span style={{ fontSize: 11, color: stateVar(s), textTransform: 'capitalize' }}>{s}</span>
          {d === worst && <span className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>◂ worst</span>}
        </div>
      ))}
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e7eef4', margin: '0 0 8px' }}>
        <span className="mono" style={{ color: 'var(--txt3)', marginRight: 8 }}>{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export function Methodology() {
  const { setView } = useAppActions();
  const p = { color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.65 } as const;

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '28px 24px 90px' }}>
        <button onClick={() => setView('dashboard')} style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 18 }}>← Dashboard</button>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#e7eef4', margin: '0 0 12px' }}>Methodology</h1>
        <p style={{ ...p, maxWidth: 680 }}>
          GeoPulse surfaces <em>what changed, when, and by how much relative to each country's own baseline</em> —
          never editorial judgment disguised as data. Every state decomposes to raw observations
          (composite → domain → z-score → value·source·timestamp).
        </p>

        <Section n="1" title="Z-scores vs the 90-day baseline">
          <p style={p}>
            For each metric we compute <span className="mono">z = (x − μ) / σ</span> against that country's <strong>own</strong> rolling
            baseline (up to {BANDS.baselineDays} days for markets; decades for annual macro), clamped to ±4. A 2% index move
            is noise in one market and a headline in another — self-relative scoring keeps the map honest.
          </p>
          <ZDiagram />
        </Section>

        <Section n="2" title="Worst-of composite">
          <p style={p}>A country is as healthy as its worst subsystem (the AWS model). The composite is the worst of its scored domains; per-domain chips preserve the nuance.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <CompositeExample name="Japan" result="degraded" worst="markets" domains={[['economy', 'operational'], ['markets', 'degraded'], ['relations', 'operational']]} />
            <CompositeExample name="Argentina" result="disrupted" worst="economy" domains={[['economy', 'disrupted'], ['markets', 'degraded'], ['relations', 'operational']]} />
          </div>
        </Section>

        <Section n="3" title="Hysteresis">
          <p style={p}>
            To prevent flapping, a state must hold for <strong>{BANDS.N} consecutive evaluations</strong> before it commits, with
            asymmetric bands: a worse state is entered at <span className="mono">|z| = {BANDS.degraded.toFixed(1)}</span> but only
            recovers below <span className="mono">|z| = {BANDS.recover.toFixed(1)}</span>. So a single spike never moves the map,
            and a genuine shift takes {BANDS.N} cycles to register — and {BANDS.N} to clear.
          </p>
        </Section>

        <Section n="4" title="Staleness is a state">
          <p style={p}>
            When effective data coverage falls below 50% — too few inputs, or inputs aged past their metric's freshness
            window — the domain is marked <strong>stale</strong>, never silently shown as healthy. Stale renders as a grey
            diagonal hatch everywhere, distinct from operational green.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: 10, borderRadius: 8, background: 'var(--panel2)', border: '1px solid var(--line2)' }}>
            <span style={{ width: 26, height: 18, borderRadius: 3, backgroundImage: 'repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)', border: '1px solid var(--state-stale)' }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--txt2)' }}>e.g. Eritrea — last GDP print 94 days old → stale</span>
          </div>
        </Section>

        <Section n="5" title="News — a standalone domain">
          <p style={p}>
            The same GDELT 2.0 export that drives relation tone also carries, for every event, a coverage
            <em> tone</em>, a <em>Goldstein</em> conflict/cooperation score (−10…+10), and an article count. We aggregate
            these per country — over <strong>every</strong> event a country appears in, not just cross-border pairs — into
            three metrics, each z-scored against the country's own baseline like every other signal:
          </p>
          <ul style={{ ...p, paddingLeft: 18, margin: '8px 0' }}>
            <li><strong>News tone</strong> — the article-weighted average coverage tone (heavily-reported events dominate).</li>
            <li><strong>Conflict intensity</strong> — the article-weighted average Goldstein score, a direct cooperation-to-conflict scale.</li>
            <li><strong>Coverage volume</strong> — total article count, so a surge in attention registers even before tone moves.</li>
          </ul>
          <p style={p}>
            News is deliberately <strong>standalone</strong>: it is scored, colored, and selectable, but it does
            <strong> not</strong> feed the worst-of composite. GDELT already drives the Conflict/Relations domain, so letting
            it also move the headline state would give one source two votes. Treat News as a <em>media-climate</em> reading,
            not ground truth — it reflects what English-language sources <em>cover</em> and how, which self-relative z-scoring
            keeps honest but cannot make unbiased.
          </p>
        </Section>

        <Section n="6" title="Weather — standalone hazard facets">
          <p style={p}>
            A keyless <a href="https://open-meteo.com" target="_blank" rel="noreferrer" style={{ color: 'var(--txt)' }}>Open-Meteo</a> worker
            samples <strong>temperature, precipitation, and wind</strong> hourly at each country's capital in one batched call.
            These are <em>independent</em> hazards, so rather than average them into one muddy number we score each as its own
            <strong> facet</strong> — <span className="mono">weather_temp</span>, <span className="mono">weather_precip</span>,
            {' '}<span className="mono">weather_wind</span> — through the same self-relative z-score every other metric uses,
            each measured against that country's <strong>own</strong> recent baseline. The overlay's Temperature / Precipitation /
            Wind modes paint land by each facet's weekly aggregate; a <strong>Value / Anomaly</strong> toggle can instead color the
            map by that anomaly directly — the per-country z that drives the incidents — so "unusual for this country" is visible at
            a glance rather than inferred from the absolute value.
          </p>
          <ul style={{ ...p, paddingLeft: 18, margin: '8px 0' }}>
            <li>
              <strong>Temperature</strong> — the 7-day <strong>mean</strong> °C, scored <strong>two-sided</strong>: an unusual
              spike <em>or</em> plunge is an anomaly, so 42&nbsp;°C in Dubai in summer reads as normal-for-Dubai while a genuine
              swing either way reads as heat or cold.
            </li>
            <li>
              <strong>Precipitation</strong> — the 7-day <strong>total</strong> mm, coloring the map by real accumulation. Rain
              is heavily right-skewed and zero-inflated (most days are dry), so a Gaussian z on raw millimetres is meaningless;
              the flood anomaly is the current accumulation's <strong>percentile</strong> in the country's own precipitation
              distribution (an empirical CDF, robust to the skew). Flood is <strong>one-sided</strong> (high tail); the dry tail
              is a separate <strong>drought</strong> facet — a long-window rainfall <em>deficit</em> versus the climatological
              normal — so a persistent shortfall opens its own <span className="mono">country:weather_drought</span> incident.
            </li>
            <li>
              <strong>Wind</strong> — the 7-day <strong>maximum</strong> km/h (the gust that matters, not a mean), scored
              <strong> one-sided</strong>: only an unusually windy week escalates, so a becalmed week never opens a "wind event."
            </li>
          </ul>
          <p style={p}>
            Each facet opens <strong>its own</strong> incident at the <span className="mono">disrupted</span> floor
            (|z|&nbsp;≥&nbsp;{BANDS.disrupted.toFixed(0)}) — a flood risk, a wind event, a heat/cold anomaly, or a drought — with
            independent hysteresis and resolution. The anomaly is measured against a <strong>day-of-year climatology</strong>
            (a same-time-of-year normal built from years of Open-Meteo archive data), so it means "unusual for this country at
            this time of year," not merely "versus the recent past" — and it lets a facet score from a single fresh reading
            rather than waiting weeks for a self-baseline. Where a normal isn't available yet it falls back to the
            {BANDS.baselineDays}-day self-window. One caveat remains: a single capital point misses hazards elsewhere in a large country. Like News, weather is
            deliberately <strong>standalone</strong>: every facet is scored, colored, and drives its own incidents, but
            <strong> none</strong> feed the worst-of composite — a heatwave or a gale is an adjacent stressor, not a country's
            geopolitical-risk state itself. <em>Cloud cover</em> and a full 3D atmospheric field are deferred to a later phase.
          </p>
        </Section>

        <Section n="7" title="Atmospheric field — an ambient layer">
          <p style={p}>
            Above the choropleth floats a second, categorically different weather layer: a
            <strong> global grid</strong> of cloud cover and wind sampled from Open-Meteo, served packed and rendered as a
            <strong> volumetric cloud layer</strong> — a WebGL2 shader raymarches a thin cloud shell above the surface,
            taking <em>coverage</em> (where cloud sits) from the interpolated field and <em>volume</em> (its billowing
            form) from baked worley-perlin 3D noise, sun-lit and standing up over the horizon. Where the GPU is
            unavailable it falls back to a continuous canvas texture of the same field. This is where <strong>cloud cover</strong> lives — and deliberately
            <em> nowhere else</em>. Cloud is not a per-country hazard you z-score ("is Germany unusually cloudy?" is
            not a risk signal), so the field is treated as pure ambient context: it has <strong>no country, no
            baseline, no z-score, and no state</strong>. It is <strong>not</strong> written to the observation store,
            <strong> not</strong> rolled into a domain, <strong>not</strong> part of the worst-of composite, and
            <strong> never</strong> opens an incident. The grid is fetched on a slow cadence, cached as one blob, and
            served straight to the globe — a parallel path that never touches the scoring spine, so it can be added or
            removed without moving a single country's state. The <strong>storm spirals are now live</strong>: a keyless
            <a href="https://www.nhc.noaa.gov" target="_blank" rel="noreferrer" style={{ color: 'var(--txt)' }}> NHC</a> feed
            places each active tropical cyclone at its real position, sized by Saffir-Simpson category and drawn with a
            near-term track, and each opens a <span className="mono">country:storm</span> incident for the countries it
            threatens — feature data that drives incidents but, like the field, is never z-scored into the composite.
          </p>
        </Section>

        <p className="mono" style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 34, lineHeight: 1.7 }}>
          Sources · Twelve Data (equity, ≤hourly) · GDELT 2.0 (relation tone + per-country news, 15 min) · World Bank
          (macro, daily) · open.er-api.com (FX, 15 min) · Open-Meteo (temperature · precipitation · wind, hourly, +
          global cloud/wind field · CC-BY). Bands mirror the scoring-engine config.
        </p>
      </div>
    </div>
  );
}
