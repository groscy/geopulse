/*
 * Live updates — capability: live-updates (tasks 7.1-7.3).
 * Owns the tiles + incidents in memory, seeded from the DataSource. When the
 * API is live (VITE_API_BASE), subscribes to the SSE stream: `tile` events patch
 * the affected tile in place (no full reload), `incident` events refetch the
 * feed, and either resets the freshness counter. Auto-reconnects and reconciles
 * via a refetch on reconnect. Falls back to polling for fixtures / if SSE drops.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { dataSource } from './source';
import { useAppActions } from '../state/store';
import type { Incident, Tile } from './types';

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
// Same-origin deploys set VITE_API_BASE='/'; strip the trailing slash so the SSE
// URL is `/api/stream`, not the protocol-relative `//api/stream`.
const API_ORIGIN = API_BASE?.replace(/\/$/, '');

interface Live {
  tiles: Tile[];
  incidents: Incident[];
  refreshIncidents: () => void;
}
const LiveCtx = createContext<Live | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const { markFresh } = useAppActions();
  const markRef = useRef(markFresh);
  markRef.current = markFresh;

  const refreshTiles = useCallback(() => { dataSource.tiles().then(setTiles).catch(() => {}); }, []);
  const refreshIncidents = useCallback(() => { dataSource.incidents('all').then(setIncidents).catch(() => {}); }, []);

  useEffect(() => { refreshTiles(); refreshIncidents(); }, [refreshTiles, refreshIncidents]);

  // polling fallback (fixtures, and a safety net if SSE silently drops)
  useEffect(() => {
    const id = window.setInterval(() => { refreshTiles(); refreshIncidents(); }, API_BASE ? 30000 : 60000);
    return () => window.clearInterval(id);
  }, [refreshTiles, refreshIncidents]);

  // SSE live channel (API mode only)
  useEffect(() => {
    if (!API_BASE) return;
    let es: EventSource | null = null;
    let closed = false;
    let retry: number | undefined;

    const connect = () => {
      es = new EventSource(`${API_ORIGIN}/api/stream`);
      es.addEventListener('tile', (e) => {
        const d = JSON.parse((e as MessageEvent).data) as { country: string; state: Tile['state'] };
        setTiles((prev) => {
          const i = prev.findIndex((t) => t.country === d.country);
          if (i === -1) return [...prev, { country: d.country, state: d.state, value: 0, computedAt: '' }];
          const next = prev.slice();
          next[i] = { ...next[i], state: d.state };
          return next;
        });
        markRef.current();
      });
      es.addEventListener('incident', () => { refreshIncidents(); markRef.current(); });
      es.onerror = () => {
        es?.close();
        if (!closed) retry = window.setTimeout(() => { refreshTiles(); refreshIncidents(); connect(); }, 3000);
      };
    };
    connect();
    return () => { closed = true; if (retry) window.clearTimeout(retry); es?.close(); };
  }, [refreshTiles, refreshIncidents]);

  return <LiveCtx.Provider value={{ tiles, incidents, refreshIncidents }}>{children}</LiveCtx.Provider>;
}

export function useLive(): Live {
  const v = useContext(LiveCtx);
  if (!v) throw new Error('useLive must be used within LiveProvider');
  return v;
}
