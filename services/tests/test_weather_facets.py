"""Weather hazard facets — verification (change: add-weather-hazard-facets).

Exercises the REAL functions from services/scoring-engine/main.py and
services/weather-worker/main.py. The heavy runtime deps (psycopg / httpx) are
stubbed so the pure logic runs locally without Docker or a DB; the worker's
network + DB are monkeypatched. Run inside the services image for a full pass.

Run: `python services/tests/test_weather_facets.py` (from repo root)
or `python -m pytest services/tests/test_weather_facets.py`.
"""
import importlib.util
import math
import os
import statistics
import sys
import types
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(__file__)
SERVICES = os.path.join(HERE, "..")
sys.path.insert(0, SERVICES)


# --- stub the Docker-only runtime deps so pure logic imports locally ---
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
try:
    import httpx  # noqa: F401
except ModuleNotFoundError:
    _stub("httpx", Client=object)


def _load(rel_path: str, name: str) -> types.ModuleType:
    path = os.path.join(SERVICES, *rel_path.split("/"))
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


scoring = _load("scoring-engine/main.py", "scoring_main")
worker = _load("weather-worker/main.py", "weather_main")
from common import config, scheduler  # noqa: E402

NOW = datetime(2026, 7, 11, tzinfo=timezone.utc)
FACETS = ["weather_temp", "weather_precip", "weather_wind"]


def _series(vals: list[float]):
    return [(float(v), NOW - timedelta(hours=len(vals) - i)) for i, v in enumerate(vals)]


# ---- 7.2: each facet single-metric, directional, precip on log1p ----
def test_facets_are_single_metric():
    # single metric per facet domain => score_domain's weighted mean IS that
    # metric's z (structurally no cross-hazard blending).
    for f in FACETS:
        assert config.DOMAIN_METRICS[f] == [f]
        assert config.WEIGHTS[f] == {f: 1.0}


def test_directionality_config():
    # the three point facets (drought, added later, is 'low')
    assert config.SIDED["weather_temp"] == "both"
    assert config.SIDED["weather_precip"] == "high"
    assert config.SIDED["weather_wind"] == "high"


def test_one_sided_low_tail_stays_operational():
    # a calm week (strongly negative wind z) must NOT escalate
    assert scoring._state_from_z(scoring._dir_mag(-2.5, "high")) == "operational"
    assert scoring._dir_mag(-2.5, "high") == 0.0


def test_one_sided_high_tail_escalates():
    # a gale (z >= 2 on the high tail) reaches disrupted
    assert scoring._state_from_z(scoring._dir_mag(2.5, "high")) == "disrupted"


def test_two_sided_escalates_either_tail():
    assert scoring._state_from_z(scoring._dir_mag(-2.5, "both")) == "disrupted"  # cold
    assert scoring._state_from_z(scoring._dir_mag(2.5, "both")) == "disrupted"   # heat


def test_precip_z_percentile_raw_preserved():
    # precip now uses the empirical-CDF percentile anomaly (supersedes log1p); the raw
    # millimetres remain untouched for display, and a high value scores a high z.
    vals = [0, 0, 1, 0, 3, 0, 0, 2, 0, 0, 5, 0, 1, 0, 0, 4, 0, 0, 2, 0, 1, 0, 0, 8.0]
    res = scoring._series_z(_series(vals), "weather_precip", NOW)
    assert res["latest"] == 8.0                                   # raw mm preserved
    assert res["series"][-1] == 8.0
    assert res["mean"] == round(statistics.fmean(vals), 4)        # percentile path reports raw mean
    assert res["z"] > 1.5                                         # a top-of-distribution reading


def test_non_transformed_metric_uses_raw():
    vals = [10, 12, 8, 40, 9, 11, 7, 13, 60.0] + [10.0] * 16
    res = scoring._series_z(_series(vals), "weather_wind", NOW)
    assert res["mean"] == round(statistics.fmean(vals), 4)  # no transform for wind


# ---- 7.3: composite excludes weather facets; legacy `weather` ignored ----
def test_weather_facet_does_not_worsen_composite():
    committed = {"markets": "operational", "economy": "operational", "relations": "operational",
                 "weather_precip": "disrupted", "weather_wind": "disrupted"}
    state, _worst = scoring.composite_of(committed)
    assert state == "operational"
    assert set(scoring.COMPOSITE_DOMAINS) == {"markets", "economy", "relations"}


def test_legacy_weather_domain_harmless():
    assert "weather" not in scoring.COMPOSITE_DOMAINS
    assert "weather" not in scoring.INCIDENT_DOMAINS
    committed = {"weather": "disrupted", "markets": "operational",
                 "economy": "operational", "relations": "operational"}
    assert scoring.composite_of(committed)[0] == "operational"  # legacy rows ignored


# ---- 7.4: per-facet incidents, titles, floors; news opens none ----
def test_incident_domains_cover_facets_not_news():
    for f in FACETS:
        assert f in scoring.INCIDENT_DOMAINS
    assert "news" not in scoring.INCIDENT_DOMAINS  # news stays incident-free


def test_incident_floors_disrupted_per_facet():
    for f in FACETS:
        assert config.WEATHER_INCIDENT_FLOORS[f] == "disrupted"


def test_incident_titles_per_facet():
    T = scoring._incident_title
    assert T("Testland", "weather_temp", "disrupted", {"z": 2.5}) == "Testland · heat anomaly"
    assert T("Testland", "weather_temp", "disrupted", {"z": -2.5}) == "Testland · cold anomaly"
    assert T("Testland", "weather_precip", "disrupted", {"z": 3.0}) == "Testland · flood risk"
    assert T("Testland", "weather_wind", "disrupted", {"z": 3.0}) == "Testland · wind event"
    assert T("Testland", "markets", "degraded", {"z": -1.5}) == "Testland · markets degraded"


# ---- 7.1: worker emits three metrics from one batched call; graceful skip ----
class _Resp:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def _fake_httpx(data, box):
    class _Client:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url, params=None, timeout=None):
            box["url"], box["params"] = url, params
            return _Resp(data)

    return types.SimpleNamespace(Client=_Client)


def _prep_worker(monkey_points):
    """Reset worker state and stub bucket/faults/db; return the captured-obs list."""
    worker._conn = None
    worker.config.WEATHER_POINTS = monkey_points
    worker.bucket.take = lambda max_wait=20: True
    worker.faults.check = lambda name: None
    worker.db.connect = lambda: types.SimpleNamespace(closed=False)
    captured = {"obs": None}

    def _upsert(conn, obs):
        captured["obs"] = list(obs)
        return len(captured["obs"])

    worker.db.upsert_observations = _upsert
    return captured


def test_worker_emits_three_metrics_from_one_call():
    box = {}
    captured = _prep_worker({"USA": (38.9, -77.0), "JPN": (35.7, 139.7)})
    worker.httpx = _fake_httpx([
        {"current": {"temperature_2m": 12.0, "precipitation": 3.5, "wind_speed_10m": 20.0}},
        {"current": {"temperature_2m": 25.0, "precipitation": 0.0, "wind_speed_10m": 40.0}},
    ], box)
    worker.cycle()
    # one batched request carrying all three fields (no cloud)
    assert box["params"]["current"] == "temperature_2m,precipitation,wind_speed_10m"
    got = {(o.metric, o.country): o.value for o in captured["obs"]}
    assert got[("weather_temp", "USA")] == 12.0
    assert got[("weather_precip", "USA")] == 3.5
    assert got[("weather_wind", "USA")] == 20.0
    assert got[("weather_precip", "JPN")] == 0.0  # a dry point still emits 0mm
    assert all(o.source == "open-meteo" for o in captured["obs"])
    assert len(captured["obs"]) == 6


def test_worker_tolerates_partial_fields():
    box = {}
    captured = _prep_worker({"USA": (38.9, -77.0), "JPN": (35.7, 139.7)})
    worker.httpx = _fake_httpx([
        {"current": {"temperature_2m": 12.0, "precipitation": 3.5, "wind_speed_10m": 20.0}},
        {"current": {"temperature_2m": 25.0, "wind_speed_10m": 40.0}},  # JPN missing precip
    ], box)
    worker.cycle()
    metrics = {(o.country, o.metric) for o in captured["obs"]}
    assert ("JPN", "weather_precip") not in metrics       # missing metric skipped
    assert ("JPN", "weather_temp") in metrics and ("JPN", "weather_wind") in metrics
    assert len(captured["obs"]) == 5                       # batch not failed


def test_worker_skips_on_empty_bucket():
    captured = _prep_worker({"USA": (38.9, -77.0)})
    worker.bucket.take = lambda max_wait=20: False  # quota exhausted
    worker.cycle()
    assert captured["obs"] is None  # no write — cycle cleanly skipped


def test_worker_outage_is_non_fatal():
    captured = _prep_worker({"USA": (38.9, -77.0)})

    class _Boom:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            raise RuntimeError("upstream down")

    worker.httpx = types.SimpleNamespace(Client=_Boom)
    # the scheduler wraps every cycle in _safe: an outage is logged, never crashes,
    # and no bad value is written (last-known observations remain in place).
    scheduler._safe("weather", worker.cycle)
    assert captured["obs"] is None


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
