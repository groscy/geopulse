"""Fault-injection seam tests (tasks 1.1, 1.2, 2.4).

Confirms each configured mode raises the right (catchable) fault, and that the
seam is OFF when unconfigured. Run: `python services/tests/test_faults.py`.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common import faults  # noqa: E402


def _with(env, provider):
    old = os.environ.get("FAULT_INJECT")
    os.environ["FAULT_INJECT"] = env
    try:
        faults.check(provider)
        return None
    except faults.FaultInjected as e:
        return type(e)
    finally:
        if old is None:
            os.environ.pop("FAULT_INJECT", None)
        else:
            os.environ["FAULT_INJECT"] = old


def test_quota():
    assert _with("twelvedata=quota", "twelvedata") is faults.QuotaExhausted


def test_timeout():
    assert _with("worldbank=timeout", "worldbank") is faults.UpstreamTimeout


def test_malformed():
    assert _with("gdelt=malformed", "gdelt") is faults.MalformedResponse


def test_off_by_default():
    os.environ.pop("FAULT_INJECT", None)
    assert faults.check("twelvedata") is None  # no fault when unconfigured


def test_only_named_provider():
    assert _with("twelvedata=quota", "worldbank") is None  # other providers unaffected


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
