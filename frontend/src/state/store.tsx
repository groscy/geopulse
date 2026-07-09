/*
 * App state store — capability: motion-and-accessibility (task 3.4) + app-shell (focus rule, task 2.5).
 * A single source of truth (React context + reducer) matching the handoff's
 * single-component state. A 1s interval drives the UTC clock + freshness counter.
 * Side effects keep reduceMotion (root attribute) and accent (CSS var + canvas)
 * in sync with state.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { DEFAULT_ACCENT } from '../theme/colors';
import { setAccent } from './accent';
import { applyReduceMotion } from './motion';
import {
  OVERLAYS_WITH_PANEL,
  type AppState,
  type FeedFilter,
  type HealthMetric,
  type IndView,
  type OverlayId,
  type View,
} from './types';

const initialState: AppState = {
  domain: 'composite',
  overlays: { relations: false, industry: false, air: false, sat: false, weather: false, sun: false },
  focus: 'feed',
  selected: null,
  modal: null,
  industry: 'semis',
  indView: 'players',
  feedFilter: 'all',
  searchOpen: false,
  searchQ: '',
  now: '--:--:--',
  freshAgo: 0,
  view: 'dashboard',
  reduceMotion: false,
  autoRotate: true,
  accent: DEFAULT_ACCENT,
};

type Action =
  | { type: 'setDomain'; domain: HealthMetric }
  | { type: 'toggleOverlay'; id: OverlayId }
  | { type: 'select'; iso: string | null }
  | { type: 'openModal'; id: string }
  | { type: 'closeModal' }
  | { type: 'setIndustry'; id: string }
  | { type: 'setIndView'; v: IndView }
  | { type: 'setFeedFilter'; f: FeedFilter }
  | { type: 'toggleSearch' }
  | { type: 'setSearchQ'; q: string }
  | { type: 'setView'; view: View }
  | { type: 'setReduceMotion'; v: boolean }
  | { type: 'setAutoRotate'; v: boolean }
  | { type: 'setAccent'; hex: string }
  | { type: 'tick'; now: string }
  | { type: 'markFresh' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setDomain':
      return { ...state, domain: action.domain };
    case 'toggleOverlay': {
      const on = !state.overlays[action.id];
      const overlays = { ...state.overlays, [action.id]: on };
      // focus rule: overlays with their own panel take focus when turned on;
      // when turned off, if they held focus, fall back to the feed.
      let focus = state.focus;
      if (OVERLAYS_WITH_PANEL.includes(action.id)) {
        if (on) focus = action.id;
        else if (focus === action.id) focus = 'feed';
      }
      return { ...state, overlays, focus };
    }
    case 'select':
      return { ...state, selected: action.iso };
    case 'openModal':
      return { ...state, modal: action.id };
    case 'closeModal':
      return { ...state, modal: null };
    case 'setIndustry':
      return { ...state, industry: action.id };
    case 'setIndView':
      return { ...state, indView: action.v };
    case 'setFeedFilter':
      return { ...state, feedFilter: action.f };
    case 'toggleSearch':
      return { ...state, searchOpen: !state.searchOpen };
    case 'setSearchQ':
      return { ...state, searchQ: action.q };
    case 'setView':
      return { ...state, view: action.view };
    case 'setReduceMotion':
      return { ...state, reduceMotion: action.v };
    case 'setAutoRotate':
      return { ...state, autoRotate: action.v };
    case 'setAccent':
      return { ...state, accent: action.hex };
    case 'tick':
      return { ...state, now: action.now, freshAgo: state.freshAgo + 1 };
    case 'markFresh':
      return { ...state, freshAgo: 0 };
    default:
      return state;
  }
}

const StateCtx = createContext<AppState | null>(null);
const DispatchCtx = createContext<React.Dispatch<Action> | null>(null);

function utcClock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 1s clock: tick the UTC time + freshness counter.
  useEffect(() => {
    dispatch({ type: 'tick', now: utcClock() });
    const id = window.setInterval(() => dispatch({ type: 'tick', now: utcClock() }), 1000);
    return () => window.clearInterval(id);
  }, []);

  // keep reduceMotion (root attribute) and accent (CSS var + canvas) in sync.
  useEffect(() => applyReduceMotion(state.reduceMotion), [state.reduceMotion]);
  useEffect(() => setAccent(state.accent), [state.accent]);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useAppState(): AppState {
  const s = useContext(StateCtx);
  if (!s) throw new Error('useAppState must be used within AppProvider');
  return s;
}

export function useAppActions() {
  const dispatch = useContext(DispatchCtx);
  if (!dispatch) throw new Error('useAppActions must be used within AppProvider');
  return useMemo(
    () => ({
      setDomain: (domain: HealthMetric) => dispatch({ type: 'setDomain', domain }),
      toggleOverlay: (id: OverlayId) => dispatch({ type: 'toggleOverlay', id }),
      select: (iso: string | null) => dispatch({ type: 'select', iso }),
      openModal: (id: string) => dispatch({ type: 'openModal', id }),
      closeModal: () => dispatch({ type: 'closeModal' }),
      setIndustry: (id: string) => dispatch({ type: 'setIndustry', id }),
      setIndView: (v: IndView) => dispatch({ type: 'setIndView', v }),
      setFeedFilter: (f: FeedFilter) => dispatch({ type: 'setFeedFilter', f }),
      toggleSearch: () => dispatch({ type: 'toggleSearch' }),
      setSearchQ: (q: string) => dispatch({ type: 'setSearchQ', q }),
      setView: (view: View) => dispatch({ type: 'setView', view }),
      setReduceMotion: (v: boolean) => dispatch({ type: 'setReduceMotion', v }),
      setAutoRotate: (v: boolean) => dispatch({ type: 'setAutoRotate', v }),
      setAccent: (hex: string) => dispatch({ type: 'setAccent', hex }),
      markFresh: () => dispatch({ type: 'markFresh' }),
    }),
    [dispatch],
  );
}
