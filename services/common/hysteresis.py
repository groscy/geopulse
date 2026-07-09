"""Pure hysteresis logic (capability: incident-detection, NFR-4).

Extracted from the scoring engine so it can be unit-tested without a DB. The
asymmetric bands (enter at |z|>=1.0, recover below |z|<0.7) plus an N-consecutive
confirmation hold prevent state flapping.
"""
from __future__ import annotations

from . import config


def desired_state(committed: str | None, absz: float) -> str:
    """The state |z| implies, given the currently-committed state (asymmetric)."""
    if committed in (None, "stale", "operational"):
        if absz >= config.ENTER_DISRUPTED:
            return "disrupted"
        if absz >= config.ENTER_DEGRADED:
            return "degraded"
        return "operational"
    if committed == "degraded":
        if absz >= config.ENTER_DISRUPTED:
            return "disrupted"
        return "operational" if absz < config.RECOVER_DEGRADED else "degraded"
    # committed == "disrupted"
    if absz < config.RECOVER_DEGRADED:
        return "operational"
    return "degraded" if absz < config.RECOVER_DISRUPTED else "disrupted"


def commit_step(committed: str, candidate: str, count: int, desired: str, n: int) -> tuple[str, str, int]:
    """Advance the (committed, candidate, count) machine by one evaluation.

    A flip to `desired` commits only after it is seen `n` consecutive times.
    Returns the new (committed, candidate, count).
    """
    if desired == committed:
        return committed, committed, 0
    if desired == candidate:
        count += 1
        if count >= n:
            return candidate, candidate, 0
        return committed, candidate, count
    return committed, desired, 1
