"""Score-stability: deterministic flap-rate replay + hysteresis tuning regression
(capability: score-stability, tasks 4.1-4.4, 6.3).

Deterministic (no wall-clock / RNG): synthetic per-country z-series are replayed
through the hysteresis machine; we count committed-state transitions (flaps) with
hysteresis vs without, assert hysteresis reduces flapping, that a sustained shift
still transitions, and that the flap rate stays under an accepted threshold.

Run: `python services/tests/test_stability.py` (from repo root).
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common import config  # noqa: E402
from common.hysteresis import commit_step, desired_state  # noqa: E402

DAYS = 90
COUNTRIES = 12
# Accepted flap rate: transitions/country over the 90-day adversarial replay.
# Set just above the tuned N=3 baseline (~4.6, vs ~5.7 without hysteresis) so the
# guard catches regressions that reintroduce flapping.
MAX_FLAP_RATE = 5.0


def _hash(i: float) -> float:
    x = math.sin(i * 12.9898) * 43758.5453
    return x - math.floor(x)


def synthetic_z(country: int) -> list[float]:
    """A noisy z-series that hovers near the degraded boundary (|z|≈1) to stress flapping."""
    return [
        1.0 + 0.6 * math.sin(d / 6.0 + country) + (_hash(country * 100 + d) - 0.5) * 1.2
        for d in range(DAYS)
    ]


def sustained_z(country: int) -> list[float]:
    """Calm, then a sustained disruption in the last third."""
    return [0.2 + (_hash(country + d) - 0.5) * 0.4 if d < DAYS * 2 // 3 else 2.6 for d in range(DAYS)]


def count_flaps(z_series: list[float], n: int) -> int:
    committed, candidate, count = "operational", "operational", 0
    flaps = 0
    for z in z_series:
        desired = desired_state(committed, abs(z))
        new_committed, candidate, count = commit_step(committed, candidate, count, desired, n)
        if new_committed != committed:
            flaps += 1
        committed = new_committed
    return flaps


def final_state(z_series: list[float], n: int) -> str:
    committed, candidate, count = "operational", "operational", 0
    for z in z_series:
        committed, candidate, count = commit_step(committed, candidate, count, desired_state(committed, abs(z)), n)
    return committed


def test_hysteresis_reduces_flapping():
    with_hyst = sum(count_flaps(synthetic_z(c), config.HYSTERESIS_N) for c in range(COUNTRIES))
    without = sum(count_flaps(synthetic_z(c), 1) for c in range(COUNTRIES))
    assert with_hyst < without, f"hysteresis={with_hyst} not < no-hysteresis={without}"


def test_flap_rate_under_threshold():
    total = sum(count_flaps(synthetic_z(c), config.HYSTERESIS_N) for c in range(COUNTRIES))
    rate = total / COUNTRIES
    assert rate <= MAX_FLAP_RATE, f"flap rate {rate:.2f} > {MAX_FLAP_RATE}"


def test_sustained_event_still_transitions():
    # a genuine sustained disruption must NOT be smoothed away by hysteresis
    assert final_state(sustained_z(0), config.HYSTERESIS_N) == "disrupted"


def test_committed_defaults():
    # the tuned defaults are the ones committed to config
    assert config.HYSTERESIS_N == 3
    assert config.ENTER_DEGRADED == 1.0 and config.RECOVER_DEGRADED == 0.7


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
    # report the measured flap rate for visibility
    total = sum(count_flaps(synthetic_z(c), config.HYSTERESIS_N) for c in range(COUNTRIES))
    print(f"\nmeasured flap rate: {total / COUNTRIES:.2f} transitions/country/90d "
          f"(N={config.HYSTERESIS_N}); no-hysteresis: "
          f"{sum(count_flaps(synthetic_z(c), 1) for c in range(COUNTRIES)) / COUNTRIES:.2f}")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
