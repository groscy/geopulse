/*
 * GeoPulse app root — wires the state provider around the app shell.
 * design-system foundation: tokens + shell + motion/state + fixtures.
 */
import { AppProvider } from './state/store';
import { LiveProvider } from './data/live';
import { Shell } from './layout/Shell';

export default function App() {
  return (
    <AppProvider>
      <LiveProvider>
        <Shell />
      </LiveProvider>
    </AppProvider>
  );
}
