"""Token-bucket quota-compliance tests (task 2.2).

Run: `python services/tests/test_ratelimit.py` (from repo root).
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.ratelimit import TokenBucket  # noqa: E402


def test_burst_capped_at_capacity():
    b = TokenBucket(rate_per_sec=1000, capacity=3)
    granted = sum(1 for _ in range(3) if b.take(tokens=1, max_wait=0.001))
    assert granted == 3, granted
    # bucket is now empty; a 4th immediate take (max_wait 0) should fail
    assert b.take(tokens=1, max_wait=0.0) is False


def test_sustained_load_never_exceeds_rate():
    # 20 tokens/sec, small burst; over a window, grants must stay under rate*window + capacity
    rate, capacity, window = 20.0, 2, 0.4
    b = TokenBucket(rate_per_sec=rate, capacity=capacity)
    start = time.monotonic()
    n = 0
    while time.monotonic() - start < window:
        if b.take(tokens=1, max_wait=0.02):
            n += 1
    ceiling = rate * window + capacity + 2  # small tolerance
    assert n <= ceiling, f"granted {n} > ceiling {ceiling}"


def test_deferral_when_empty():
    b = TokenBucket(rate_per_sec=1.0, capacity=1)
    assert b.take(max_wait=0.5) is True   # first token
    assert b.take(max_wait=0.2) is False  # not enough time to refill -> graceful defer


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
