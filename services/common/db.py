"""Database access — thin psycopg3 wrapper with reconnect + batch upserts."""
from __future__ import annotations

import time
from collections.abc import Iterable, Sequence
from typing import Any

import psycopg

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
