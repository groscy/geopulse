/*
 * Left rail — capability: app-shell (task 2.3). Search toggle, independent
 * Overlay toggles, pinned Methodology + Settings.
 * Active = 3px emerald edge-bar (.rail-btn.active in layout.css) + icon brighten.
 */
import type { ReactNode } from 'react';
import { useAppActions, useAppState } from '../state/store';
import type { OverlayId } from '../state/types';
import {
  IconAir,
  IconBook,
  IconIndustry,
  IconRelations,
  IconSat,
  IconSearch,
  IconSettings,
  IconSun,
  IconWeather,
} from './icons';

function RailBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button className={`rail-btn${active ? ' active' : ''}`} onClick={onClick} title={title} aria-pressed={active}>
      {children}
    </button>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="section-label" style={{ textAlign: 'center', padding: '10px 0 4px' }}>
      {children}
    </div>
  );
}

const OVERLAYS: { id: OverlayId; title: string; icon: ReactNode }[] = [
  { id: 'relations', title: 'Relations', icon: <IconRelations /> },
  { id: 'industry', title: 'Industries', icon: <IconIndustry /> },
  { id: 'air', title: 'Air traffic', icon: <IconAir /> },
  { id: 'sat', title: 'Satellites', icon: <IconSat /> },
  { id: 'weather', title: 'Meteorological', icon: <IconWeather /> },
  { id: 'sun', title: 'Day / night', icon: <IconSun /> },
];

export function LeftRail({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { overlays, searchOpen, view } = useAppState();
  const { toggleOverlay, toggleSearch, setView } = useAppActions();

  return (
    <nav
      style={{
        width: 'var(--rail-w)',
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel2)',
        borderRight: '1px solid var(--line)',
      }}
    >
      <RailBtn active={searchOpen} onClick={toggleSearch} title="Search">
        <IconSearch />
      </RailBtn>

      <div className="panel-scroll" style={{ flex: 1 }}>
        <GroupLabel>Overlays</GroupLabel>
        {OVERLAYS.map((o) => (
          <RailBtn key={o.id} active={overlays[o.id]} onClick={() => toggleOverlay(o.id)} title={o.title}>
            {o.icon}
          </RailBtn>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--line2)', paddingTop: 2 }}>
        <RailBtn active={view === 'methodology'} onClick={() => setView(view === 'methodology' ? 'dashboard' : 'methodology')} title="Methodology">
          <IconBook />
        </RailBtn>
        <RailBtn onClick={onOpenSettings} title="Settings (tweaks)">
          <IconSettings />
        </RailBtn>
      </div>
    </nav>
  );
}
