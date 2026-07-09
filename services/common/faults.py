"""Fault injection seam (capability: rate-limit-resilience, tasks 1.1, 1.2).

Env-gated, test-only. Workers call `check(provider)` at their provider-fetch
boundary; when FAULT_INJECT names that provider, a simulated fault is raised.
The workers' existing try/except makes this a graceful skip (no crash, no bad
write) so affected scores age to stale. OFF unless FAULT_INJECT is set.

    FAULT_INJECT="twelvedata=quota,worldbank=timeout,gdelt=malformed"
"""
from __future__ import annotations

import os


class FaultInjected(Exception):
    """Base for injected faults."""


class QuotaExhausted(FaultInjected):
    pass


class UpstreamTimeout(FaultInjected):
    pass


class MalformedResponse(FaultInjected):
    pass


def _modes() -> dict[str, str]:
    out: dict[str, str] = {}
    for part in os.environ.get("FAULT_INJECT", "").split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def check(provider: str) -> None:
    """Raise the configured fault for `provider`, else no-op."""
    mode = _modes().get(provider)
    if not mode:
        return
    if mode == "quota":
        raise QuotaExhausted(f"{provider}: injected quota exhaustion")
    if mode == "timeout":
        raise UpstreamTimeout(f"{provider}: injected upstream timeout")
    if mode == "malformed":
        raise MalformedResponse(f"{provider}: injected malformed response")
