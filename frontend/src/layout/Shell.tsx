/*
 * App shell — capability: app-shell (tasks 2.1, 2.4).
 * Root: 100vh flex column, fixed top bar, body below. The body region is the
 * dashboard (rail / stage / panel) OR the methodology page; the incident modal
 * overlays either. Switching to methodology preserves dashboard state (state
 * lives in the store, components stay mounted-by-remount but selection persists).
 */
import { useState } from 'react';
import { useAppState } from '../state/store';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { GlobeStage } from './GlobeStage';
import { RightPanel } from './RightPanel';
import { SettingsPopover } from './SettingsPopover';
import { Methodology } from '../views/Methodology';
import { IncidentModal } from '../views/IncidentModal';

export function Shell() {
  const { view } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <TopBar />

      {view === 'methodology' ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Methodology />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftRail onOpenSettings={() => setSettingsOpen((v) => !v)} />
          <GlobeStage />
          <RightPanel />
          {settingsOpen && <SettingsPopover onClose={() => setSettingsOpen(false)} />}
        </div>
      )}

      <IncidentModal />
    </div>
  );
}
