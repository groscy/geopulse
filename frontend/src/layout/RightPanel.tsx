/*
 * Right panel — capability: app-shell (task 2.5, focus rule).
 * Selection wins: a selected country shows its drill-down. Otherwise the panel
 * shows the focused overlay's panel (if that overlay owns one and is on), else
 * the incident feed. Relations + Health metrics use the feed.
 */
import { useCountry } from '../data/useData';
import { useAppState } from '../state/store';
import { OVERLAYS_WITH_PANEL } from '../state/types';
import { CountryDrilldown } from '../panels/CountryDrilldown';
import { IncidentFeed } from '../panels/IncidentFeed';
import { OverlayPanel } from '../panels/OverlayPanel';

export function RightPanel() {
  const { selected, focus, overlays } = useAppState();
  const country = useCountry(selected);

  let body;
  if (selected && country) {
    body = <CountryDrilldown c={country} />;
  } else if (focus !== 'feed' && OVERLAYS_WITH_PANEL.includes(focus) && overlays[focus]) {
    body = <OverlayPanel id={focus} />;
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
