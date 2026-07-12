/*
 * Data hooks — load through the DataSource interface so components stay
 * source-agnostic (fixtures now, live API later). Capability: reference-sample-data.
 */
import { useEffect, useState } from 'react';
import { dataSource } from './source';
import type { CountryDetail, DomainKey, DomainTile, Tile } from './types';

/**
 * Poll tiles on an interval (task 8.6). With fixtures this is effectively
 * static; against the live API it refreshes composite state. `intervalMs`
 * defaults to 30s to match the markets cadence ceiling.
 */
export function useTiles(intervalMs = 30_000): Tile[] {
  const [tiles, setTiles] = useState<Tile[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => dataSource.tiles().then((t) => { if (alive) setTiles(t); });
    load();
    const id = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return tiles;
}

export function useCountries(): CountryDetail[] {
  const [rows, setRows] = useState<CountryDetail[]>([]);
  useEffect(() => {
    let alive = true;
    dataSource.countries().then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

/**
 * Per-country state for one Health domain — the global breakdown behind the
 * HealthPanel. Refetches when the selected domain changes; degrades to an empty
 * list (never throws) if the backend predates GET /api/domain-tiles.
 */
export function useDomainTiles(domain: DomainKey): DomainTile[] {
  const [rows, setRows] = useState<DomainTile[]>([]);
  useEffect(() => {
    let alive = true;
    dataSource.domainTiles(domain)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [domain]);
  return rows;
}

export function useCountry(iso3: string | null): CountryDetail | null {
  const [row, setRow] = useState<CountryDetail | null>(null);
  useEffect(() => {
    let alive = true;
    if (!iso3) {
      setRow(null);
      return;
    }
    dataSource.country(iso3).then((r) => {
      if (alive) setRow(r);
    });
    return () => {
      alive = false;
    };
  }, [iso3]);
  return row;
}
