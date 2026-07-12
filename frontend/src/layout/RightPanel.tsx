/*
 * Right panel — capability: app-shell (task 2.5, focus rule).
 * Selection wins: a selected country shows its drill-down (with the active Health
 * metric highlighted). Otherwise a focused overlay's panel (if it owns one and is
 * on) wins; else the selected Health metric drives the panel — composite shows the
 * global incident feed, the other metrics show their global HealthPanel.
 */
import { useCountry } from '../data/useData';
import { useAppState } from '../state/store';
import { OVERLAYS_WITH_PANEL } from '../state/types';
import { CountryDrilldown } from '../panels/CountryDrilldown';
import { HealthPanel } from '../panels/HealthPanel';
import { IncidentFeed } from '../panels/IncidentFeed';
import { OverlayPanel } from '../panels/OverlayPanel';

export function RightPanel() {
  const { selected, focus, overlays, domain } = useAppState();
  const country = useCountry(selected);

  let body;
  if (selected && country) {
    body = <CountryDrilldown c={country} highlight={domain} />;
  } else if (focus !== 'feed' && OVERLAYS_WITH_PANEL.includes(focus) && overlays[focus]) {
    body = <OverlayPanel id={focus} />;
  } else if (domain !== 'composite') {
    body = <HealthPanel domain={domain} />;
  } else {
    body = <IncidentFeed />;
  }

  return (
    <aside
      style={{
        width: 'var(--panel-w)',
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--line)',
        overflowY: 'auto',
      }}
    >
      {body}
    </aside>
  );
}
