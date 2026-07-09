"""Migration runner — applies db/migrations/*.sql once, tracked in a ledger
(capability: observation-store). Idempotent; safe on every start.

Runs in autocommit with per-statement execution so TimescaleDB statements that
cannot run inside a transaction block (continuous aggregates, some policies) work.
"""
from __future__ import annotations

import os
import pathlib
import sys

import psycopg

from . import config
from .log import get_logger

log = get_logger("migrate")

MIGRATIONS_DIR = os.environ.get("MIGRATIONS_DIR", "/app/db/migrations")
LOCK_KEY = 4242


def split_statements(sql: str) -> list[str]:
    """Split on ';' while respecting $$ dollar-quoted bodies; drop comment-only lines."""
    cleaned = "\n".join(ln for ln in sql.splitlines() if not ln.strip().startswith("--"))
    stmts: list[str] = []
    buf = ""
    in_dollar = False
    i = 0
    while i < len(cleaned):
        if cleaned[i:i + 2] == "$$":
            in_dollar = not in_dollar
            buf += "$$"
            i += 2
            continue
        ch = cleaned[i]
        if ch == ";" and not in_dollar:
            if buf.strip():
                stmts.append(buf.strip())
            buf = ""
        else:
            buf += ch
        i += 1
    if buf.strip():
        stmts.append(buf.strip())
    return stmts


def run() -> int:
    mig_dir = pathlib.Path(MIGRATIONS_DIR)
    files = sorted(mig_dir.glob("*.sql"))
    if not files:
        log.warning("no migration files in %s", mig_dir)
        return 0

    conn = psycopg.connect(config.DATABASE_URL, autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(%s)", (LOCK_KEY,))
            cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations "
                        "(filename text PRIMARY KEY, applied_at timestamptz DEFAULT now())")
            cur.execute("SELECT filename FROM schema_migrations")
            applied = {r[0] for r in cur.fetchall()}

        count = 0
        for f in files:
            if f.name in applied:
                log.info("skip %s (already applied)", f.name)
                continue
            log.info("applying %s", f.name)
            for stmt in split_statements(f.read_text(encoding="utf-8")):
                with conn.cursor() as cur:
                    cur.execute(stmt)
            with conn.cursor() as cur:
                cur.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (f.name,))
            count += 1

        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))
        log.info("migrations complete (%d applied)", count)
        return count
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001
        log.exception("migration failed: %s", exc)
        sys.exit(1)
