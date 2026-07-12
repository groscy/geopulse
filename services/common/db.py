"""Database access — thin psycopg3 wrapper with reconnect + batch upserts."""
from __future__ import annotations

import time
from collections.abc import Iterable, Sequence
from typing import Any

import psycopg
from psycopg.types.json import Json

from . import config
from .log import get_logger
from .models import DyadObservation, Observation

log = get_logger("db")


def connect(retries: int = 30, delay: float = 2.0) -> psycopg.Connection:
    """Connect with autocommit, retrying while the DB comes up."""
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg.connect(config.DATABASE_URL, autocommit=True)
            log.info("connected to database")
            return conn
        except Exception as exc:  # noqa: BLE001 - retry any connection failure
            last = exc
            log.warning("db connect attempt %d/%d failed: %s", attempt, retries, exc)
            time.sleep(delay)
    raise RuntimeError(f"could not connect to database: {last}")


def upsert_observations(conn: psycopg.Connection, obs: Iterable[Observation]) -> int:
    rows = [
        (o.country, o.metric, o.value, o.ts, o.source, o.confidence) for o in obs
    ]
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO observation (country, metric, value, ts, source, confidence)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (country, metric, ts, source)
            DO UPDATE SET value = EXCLUDED.value, confidence = EXCLUDED.confidence
            """,
            rows,
        )
    return len(rows)


def upsert_dyads(conn: psycopg.Connection, obs: Iterable[DyadObservation]) -> int:
    rows = [
        (o.country_a, o.country_b, o.metric, o.value, o.ts, o.source) for o in obs
    ]
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO dyad_observation (country_a, country_b, metric, value, ts, source)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (country_a, country_b, metric, ts, source)
            DO UPDATE SET value = EXCLUDED.value
            """,
            rows,
        )
    return len(rows)


def query(conn: psycopg.Connection, sql: str, params: Sequence[Any] | None = None) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


# ---- weather-field: single-blob atmospheric grid cache (capability: weather-field) ----
# Isolated from observation/score/incident — field data has no country and no z-score.
def upsert_weather_field(conn: psycopg.Connection, grid: dict) -> None:
    """Overwrite the one cached atmospheric-field grid blob (id = 1) each cycle."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO weather_field (id, grid, updated_at) VALUES (1, %s, now()) "
            "ON CONFLICT (id) DO UPDATE SET grid = EXCLUDED.grid, updated_at = now()",
            (Json(grid),),
        )


def latest_weather_field(conn: psycopg.Connection) -> tuple[dict, Any] | None:
    """Latest cached field grid + its `updated_at`, or None before the first fetch."""
    with conn.cursor() as cur:
        cur.execute("SELECT grid, updated_at FROM weather_field WHERE id = 1")
        row = cur.fetchone()
    return (row[0], row[1]) if row else None


# ---- storm-tracks: single-blob active-cyclone cache (capability: storm-tracks) ----
# Feature data, no per-country z-score; isolated from observation/score.
def upsert_storms(conn: psycopg.Connection, storms: list) -> None:
    """Overwrite the one cached active-storm list (id = 1) each cycle."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO storm (id, storms, updated_at) VALUES (1, %s, now()) "
            "ON CONFLICT (id) DO UPDATE SET storms = EXCLUDED.storms, updated_at = now()",
            (Json(storms),),
        )


def latest_storms(conn: psycopg.Connection) -> tuple[list, Any] | None:
    """Latest cached active-storm list + its `updated_at`, or None before first fetch."""
    with conn.cursor() as cur:
        cur.execute("SELECT storms, updated_at FROM storm WHERE id = 1")
        row = cur.fetchone()
    return (row[0], row[1]) if row else None


# ---- weather climatology: day-of-year normals (capability: scoring-engine) ----
# Quasi-static reference; isolated from the live observation hypertable.
def upsert_normals(conn: psycopg.Connection, rows: Iterable[tuple]) -> int:
    """rows: (country, metric, doy, mean, sd)."""
    rows = list(rows)
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT INTO weather_normal (country, metric, doy, mean, sd) VALUES (%s,%s,%s,%s,%s) "
            "ON CONFLICT (country, metric, doy) DO UPDATE SET mean=EXCLUDED.mean, sd=EXCLUDED.sd",
            rows,
        )
    return len(rows)


def normals_window(conn: psycopg.Connection, country: str, metric: str, doys: Sequence[int]) -> list[tuple]:
    """(mean, sd) rows for a metric across a set of days-of-year (empty if no normals)."""
    return query(
        conn,
        "SELECT mean, sd FROM weather_normal WHERE country=%s AND metric=%s AND doy = ANY(%s)",
        (country, metric, list(doys)),
    )


def countries_with_normals(conn: psycopg.Connection, metric: str = "weather_temp") -> set[str]:
    """ISO-3 set that already has climatology normals for `metric`."""
    return {r[0].strip() for r in query(
        conn, "SELECT DISTINCT country FROM weather_normal WHERE metric=%s", (metric,))}
