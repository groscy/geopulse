/*
 * Settings tweaks — capability: motion-and-accessibility (reduceMotion, accent,
 * autoRotate are tweakable props). The rail Settings icon is decorative in the
 * handoff; this small popover makes the tweakable props actually adjustable so
 * the accent/reduceMotion contract is demonstrable.
 */
import { DEFAULT_ACCENT } from '../theme/colors';
import { useAppActions, useAppState } from '../state/store';

export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const { reduceMotion, autoRotate, accent } = useAppState();
  const { setReduceMotion, setAutoRotate, setAccent } = useAppActions();

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 } as const;

  return (
    <div
      role="dialog"
      aria-label="Settings"
      style={{
        position: 'absolute',
        left: 'calc(var(--rail-w) + 8px)',
        bottom: 10,
        width: 240,
        padding: 14,
        borderRadius: 'var(--r-card)',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--sh-popup)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="section-label">Tweaks</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      <label style={row}>
        <span style={{ fontSize: 12 }}>Reduce motion</span>
        <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
      </label>

      <label style={row}>
        <span style={{ fontSize: 12 }}>Auto-rotate</span>
        <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
      </label>

      <label style={row}>
        <span style={{ fontSize: 12 }}>Accent</span>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--line)', background: 'none' }} />
          <button className="chip" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setAccent(DEFAULT_ACCENT)}>reset</button>
        </span>
      </label>

      <div className="mono" style={{ fontSize: 10, color: 'var(--txt3)' }}>
        Accent drives operational + warm; degraded/disrupted/stale stay fixed.
      </div>
    </div>
  );
}
