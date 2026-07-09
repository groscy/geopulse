"""Simple blocking interval scheduler — one per worker (own scheduler each)."""
from __future__ import annotations

import time
from collections.abc import Callable

from .log import get_logger

log = get_logger("scheduler")


def run_periodic(name: str, interval_s: int, job: Callable[[], None], run_now: bool = True) -> None:
    """Run `job` every `interval_s` seconds forever. A job that raises is logged
    and the loop continues (graceful degradation — a bad cycle never kills the
    worker)."""
    log.info("scheduler '%s' starting (every %ds)", name, interval_s)
    if run_now:
        _safe(name, job)
    while True:
        time.sleep(interval_s)
        _safe(name, job)


def _safe(name: str, job: Callable[[], None]) -> None:
    started = time.monotonic()
    try:
        job()
        log.info("job '%s' ok (%.1fs)", name, time.monotonic() - started)
    except Exception as exc:  # noqa: BLE001 - a cycle must never crash the worker
        log.exception("job '%s' failed, will retry next cycle: %s", name, exc)
