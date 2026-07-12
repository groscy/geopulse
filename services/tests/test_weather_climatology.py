"""Weather climatology baselines — verification (change: add-weather-climatology-baselines).

Exercises the REAL scoring-engine functions (percentile precip, day-of-year climatology
baseline with self-window fallback, drought deficit) with psycopg stubbed and the DB
monkeypatched. Pure logic — no network, no live DB.

Run: `python services/tests/test_weather_climatology.py` (from repo root)
or `python -m pytest services/tests/test_weather_climatology.py`.
"""
import importlib.util
import os
import sys
import types
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(__file__)
SERVICES = os.path.join(HERE, "..")
sys.path.insert(0, SERVICES)


def _stub(name: str, **attrs) -> types.ModuleType:
    mod = sys.modules.get(name) or types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules[name] = mod
    return mod


try:
    import psycopg  # noqa: F401
except ModuleNotFoundError:
    psy = _stub("psycopg")
    psy_types = _stub("psycopg.types")
    psy_json = _stub("psycopg.types.json", Json=lambda x: x)
    psy.types = psy_types
    psy_types.json = psy_json
    _stub("psycopg_pool", ConnectionPool=object)


def _load(rel_path: str, name: str) -> types.ModuleType:
    path = os.path.join(SERVICES, *rel_path.split("/"))
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


scoring = _load("scoring-engine/main.py", "scoring_climo_main")
from common import config  # noqa: E402

NOW = datetime(2026, 7, 12, tzinfo=timezone.utc)


# ---- pure helpers ----
def test_percentile_z_maps_to_bands():
    vals = list(range(100))  # 0..99
    assert abs(scoring._percentile_z(50, vals)) < 0.2        # median -> ~0
    assert scoring._percentile_z(99, vals) > 1.9             # top -> high z
    assert scoring._percentile_z(0, vals) < -1.9             # bottom -> low z


def test_window_and_last_doys_wrap():
    assert scoring._window_doys(1, 2) == sorted({365, 366, 1, 2, 3})  # wraps year start
    assert len(scoring._last_doys(50, 90)) == 90


def test_precip_series_z_uses_percentile():
    vals = [0.0] * 20 + [1.0, 2.0, 3.0, 40.0]  # a wet spike at the end
    series = [(v, NOW - timedelta(hours=len(vals) - i)) for i, v in enumerate(vals)]
    r = scoring._series_z(series, "weather_precip", NOW)
    assert r["latest"] == 40.0                    # raw mm preserved
    assert r["z"] > 1.5                            # top of the empirical CDF -> high z
    # a mid value would score far lower
    series2 = series[:-1] + [(0.0, NOW)]
    assert scoring._series_z(series2, "weather_precip", NOW)["z"] < r["z"]


# ---- climatology baseline routing ----
def _day(value, n=25, hours=24):
    """Ascending series spanning `hours` (a full diurnal cycle), latest last."""
    return [(float(value), NOW - timedelta(hours=hours) + timedelta(hours=hours * k / (n - 1))) for k in range(n)]


def test_metric_z_uses_climatology_when_normal_exists():
    scoring._conn = object()
    scoring.db.query = lambda conn, sql, params=None: _day(20.0)        # full day of temp=20
    scoring.db.normals_window = lambda conn, c, m, doys: [(10.0, 5.0)]  # normal mean 10, sd 5
    r = scoring.metric_z("USA", "weather_temp", NOW)
    assert r["baseline"] == "climatology"
    assert r["z"] == 2.0                            # (20 - 10) / 5, on the daily mean
    assert not r.get("stale")                       # a full day of coverage -> scores


def test_climatology_stale_without_full_diurnal_cycle():
    scoring._conn = object()
    # only ~5 hours of (afternoon-skewed) data -> a daily-mean anomaly would be biased
    scoring.db.query = lambda conn, sql, params=None: [(30.0, NOW - timedelta(hours=k)) for k in range(5)]
    scoring.db.normals_window = lambda conn, c, m, doys: [(10.0, 5.0)]
    assert scoring.metric_z("USA", "weather_temp", NOW).get("stale") is True


def test_metric_z_falls_back_to_self_window():
    scoring._conn = object()
    scoring.db.query = lambda conn, sql, params=None: [(20.0, NOW - timedelta(hours=k)) for k in range(5)]
    scoring.db.normals_window = lambda conn, c, m, doys: []            # no normal
    r = scoring.metric_z("USA", "weather_temp", NOW)
    assert r.get("stale") is True                   # self-window, < MIN_BASELINE_POINTS


# ---- drought (long-window deficit vs climatology) ----
def _drought(actual_mm_per_day, distinct_days):
    scoring._conn = object()
    scoring.db.normals_window = lambda conn, c, m, doys: [(3.0, 2.0)] * len(doys)  # exp 3mm/day
    obs = [(actual_mm_per_day, NOW - timedelta(days=d)) for d in range(distinct_days)]
    scoring.db.query = lambda conn, sql, params=None: obs
    return scoring.score_drought("USA", NOW)


def test_drought_deficit_escalates():
    r = _drought(0.3, 60)                  # ~18mm actual vs ~270mm expected, 60/90 days covered
    assert r["state"] == "disrupted" and r["z"] < 0   # a real shortfall on the low tail


def test_wet_period_opens_no_drought():
    r = _drought(10.0, 60)                 # far above the normal -> operational (one-sided low)
    assert r["state"] == "operational"


def test_drought_stale_until_window_covered():
    r = _drought(0.3, 8)                   # only 8/90 days observed -> stale (no false drought)
    assert r["state"] == "stale"


def test_drought_none_without_normal():
    scoring._conn = object()
    scoring.db.normals_window = lambda conn, c, m, doys: []
    scoring.db.query = lambda conn, sql, params=None: [(0.5, NOW)]
    assert scoring.score_drought("USA", NOW) is None


# ---- wiring ----
def test_drought_config_and_incidents():
    assert config.SIDED["weather_drought"] == "low"
    assert config.WEATHER_INCIDENT_FLOORS["weather_drought"] == "disrupted"
    assert "weather_drought" in scoring.INCIDENT_DOMAINS
    assert "weather_drought" not in scoring.COMPOSITE_DOMAINS
    assert scoring._incident_title("Testland", "weather_drought", "disrupted", {}) == "Testland · drought"


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
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
