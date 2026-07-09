/*
 * Globe stage — capability: app-shell (the flex:1 center region).
 * The actual Canvas 2D / D3-geo globe is M1 (globe-visualization); this
 * foundation renders the stage container, background, active-layer chip, and
 * the drag hint. Imperative globe state (lambda/phi/rAF) will attach here and
 * live OUTSIDE React state (see state/types.ts note).
 */
import { useAppState } from '../state/store';
import type { OverlayId } from '../state/types';
import { Globe } from '../globe/Globe';

const NAMES: Record<string, string> = {
  composite: 'Composite',
  economy: 'Economy',
  markets: 'Markets',
  conflict: 'Conflict',
  relations: 'Relations',
  industry: 'Industries',
  air: 'Air traffic',
  sat: 'Satellites',
  weather: 'Meteorological',
  sun: 'Day / night',
};
const ORDER: OverlayId[] = ['relations', 'industry', 'air', 'sat', 'weather', 'sun'];

export function GlobeStage() {
  const { domain, overlays } = useAppState();
  const activeLabels = [NAMES[domain], ...ORDER.filter((k) => overlays[k]).map((k) => NAMES[k])].join(' · ');

  return (
    <main
      style={{
        flex: 1,
        position: 'relative',
        minWidth: 0,
        background: 'radial-gradient(120% 100% at 50% 46%, #111820, #0d1116 62%, #0b0e13)',
        overflow: 'hidden',
      }}
    >
      {/* the canvas globe (M1 globe-visualization) */}
      <Globe />

      {/* top-left active-layer chip */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, pointerEvents: 'none' }}>
        <span className="section-label">Layer</span>
        <span style={{ color: 'var(--txt2)' }}>{activeLabels}</span>
      </div>

      {/* bottom-left legend (per-active-layer sections) */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '10px 12px', borderRadius: 9, background: 'color-mix(in srgb, var(--panel) 72%, transparent)', border: '1px solid var(--line2)', backdropFilter: 'var(--legend-blur)', pointerEvents: 'none', minWidth: 150 }}>
        <div className="section-label" style={{ marginBottom: 6 }}>Legend</div>
        {(['operational', 'degraded', 'disrupted', 'stale'] as const).map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s === 'stale' ? 'transparent' : `var(--state-${s})`, backgroundImage: s === 'stale' ? 'repeating-linear-gradient(45deg,#5b646f 0 2px,transparent 2px 4px)' : undefined, border: s === 'stale' ? '1px solid var(--state-stale)' : undefined }} />
            <span style={{ fontSize: 11, color: 'var(--txt2)', textTransform: 'capitalize' }}>{s}</span>
          </div>
        ))}
        {overlays.relations && (
          <div style={{ marginTop: 8 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Relation tone</div>
            <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(90deg, var(--tone-hostile), var(--tone-tense), var(--tone-warm))' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--txt3)', marginTop: 2 }}><span>hostile</span><span>warm</span></div>
          </div>
        )}
      </div>

      {/* bottom-right hint */}
      <div className="mono" style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 11, color: 'var(--txt3)', pointerEvents: 'none' }}>
        drag to rotate · click a country
      </div>
    </main>
  );
}
