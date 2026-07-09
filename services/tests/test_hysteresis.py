"""Unit tests for hysteresis flap resistance (task 2.4).

Pure logic, no DB. Run: `python services/tests/test_hysteresis.py` (from repo root)
or `python -m pytest` inside the services image.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common import config  # noqa: E402
from common.hysteresis import commit_step, desired_state  # noqa: E402

N = config.HYSTERESIS_N  # default 3


def simulate(z_sequence: list[float], start: str = "operational") -> str:
    """Feed a sequence of |z| values through the hysteresis machine; return final committed."""
    committed, candidate, count = start, start, 0
    for absz in z_sequence:
        desired = desired_state(committed, absz)
        committed, candidate, count = commit_step(committed, candidate, count, desired, N)
    return committed


def test_single_spike_does_not_flip():
    # one degraded-level reading among operational ones must NOT flip
    assert simulate([0.2, 1.4, 0.2, 0.1]) == "operational"


def test_double_spike_does_not_flip():
    assert simulate([1.4, 1.5, 0.2]) == "operational"  # 2 confirms < N=3


def test_sustained_change_commits():
    # N consecutive degraded readings commit
    assert simulate([1.4] * N) == "degraded"


def test_disrupted_commits_after_n():
    assert simulate([2.5] * N) == "disrupted"


def test_recovery_is_asymmetric():
    # from degraded, |z| in the [0.7,1.0) band must NOT recover
    assert simulate([0.85] * (N + 2), start="degraded") == "degraded"
    # below the recover band, it recovers after N
    assert simulate([0.3] * N, start="degraded") == "operational"


def test_recovery_needs_n_confirmations():
    # a single low reading does not un-commit a degraded state
    assert simulate([0.3, 1.4, 1.4], start="degraded") == "degraded"


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
