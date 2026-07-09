"""Per-provider token-bucket limiter with graceful degradation (NFR-3)."""
from __future__ import annotations

import threading
import time


class TokenBucket:
    """Classic token bucket. `take()` blocks up to `max_wait`; returns False if
    it could not acquire in time so the caller can skip the cycle gracefully."""

    def __init__(self, rate_per_sec: float, capacity: float | None = None) -> None:
        self.rate = rate_per_sec
        self.capacity = capacity if capacity is not None else max(1.0, rate_per_sec)
        self._tokens = self.capacity
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last
        self._last = now
        self._tokens = min(self.capacity, self._tokens + elapsed * self.rate)

    def take(self, tokens: float = 1.0, max_wait: float = 30.0) -> bool:
        deadline = time.monotonic() + max_wait
        while True:
            with self._lock:
                self._refill()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return True
                needed = tokens - self._tokens
                wait = needed / self.rate if self.rate > 0 else max_wait
            if time.monotonic() + wait > deadline:
                return False
            time.sleep(min(wait, 0.5))
