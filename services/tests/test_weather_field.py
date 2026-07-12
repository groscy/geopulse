"""Weather field shell — verification (change: add-weather-field-shell).

Exercises the REAL `weather-field-worker` functions with the Docker-only deps
(psycopg / httpx) stubbed and the DB / network monkeypatched. Confirms the worker
builds the global grid, derives wind u/v, caches ONE blob, degrades gracefully on
an outage, and never writes an observation/dyad row (field is isolated from the
scoring spine).

Run: `python services/tests/test_weather_field.py` (from repo root)
or `python -m pytest services/tests/test_weather_field.py`.
"""
import importlib.util
import math
import os
import sys
import types

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


worker = _load("weather-field-worker/main.py", "weather_field_main")
from common import config, scheduler  # noqa: E402


# ---- grid ----
def test_grid_nodes_cover_clamped_band():
    worker.config.WEATHER_FIELD_STEP = 15
    worker.config.WEATHER_FIELD_LAT_MIN = -60
    worker.config.WEATHER_FIELD_LAT_MAX = 75
    nodes = worker.grid_nodes()
    lats = sorted({la for la, _ in nodes})
    lons = sorted({lo for _, lo in nodes})
    assert len(nodes) == 240                       # 10 lats × 24 lons
    assert lats[0] == -60.0 and lats[-1] == 75.0
    assert lons[0] == -180.0 and 180.0 not in lons  # +180 duplicates -180, excluded


# ---- worker fetch / cache / u,v derivation ----
def _fake_httpx(current: dict, box: dict):
    class _Resp:
        def __init__(self, n):
            self._n = n

        def raise_for_status(self):
            pass

        def json(self):
            return [{"current": dict(current)} for _ in range(self._n)]

    class _Client:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url, params=None, timeout=None):
            box["calls"] = box.get("calls", 0) + 1
            box["params"] = params
            return _Resp(len(params["latitude"].split(",")))

    return types.SimpleNamespace(Client=_Client)


def _prep(step=180, batch=100):
    """Reset worker state to a tiny grid; stub bucket/faults/db; return capture dict."""
    worker._conn = None
    worker.config.WEATHER_FIELD_STEP = step
    worker.config.WEATHER_FIELD_LAT_MIN = -60
    worker.config.WEATHER_FIELD_LAT_MAX = 75
    worker.config.WEATHER_FIELD_BATCH = batch
    worker.bucket.take = lambda max_wait=20: True
    worker.faults.check = lambda name: None
    worker.db.connect = lambda: types.SimpleNamespace(closed=False)
    cap = {"grid": None, "obs": 0, "dyads": 0}
    worker.db.upsert_weather_field = lambda conn, grid: cap.update(grid=grid)
    # tripwires: the field worker must NEVER write to the scoring spine
    worker.db.upsert_observations = lambda *a, **k: cap.update(obs=cap["obs"] + 1)
    worker.db.upsert_dyads = lambda *a, **k: cap.update(dyads=cap["dyads"] + 1)
    return cap


def test_worker_caches_packed_field_blob():
    box, cap = {}, _prep(step=180)  # step 180 => lats[-60] × lons[-180,0] = 2 nodes
    worker.httpx = _fake_httpx(
        {"cloud_cover": 80, "wind_speed_10m": 10, "wind_direction_10m": 90, "precipitation": 0.5}, box)
    worker.cycle()
    grid = cap["grid"]
    assert grid is not None and grid["step"] == 180
    # packed columnar form: dims + flat per-channel arrays (no per-node objects)
    assert grid["nlat"] == 1 and grid["nlon"] == 2
    assert len(grid["cloud"]) == 2 and len(grid["u"]) == 2 and len(grid["precip"]) == 2
    assert "cells" not in grid
    assert box["params"]["current"] == "cloud_cover,wind_speed_10m,wind_direction_10m,precipitation"
    assert grid["cloud"][0] == 80.0 and grid["precip"][0] == 0.5


def test_worker_derives_wind_uv():
    box, cap = {}, _prep(step=180)
    # wind FROM the east (dir=90) at 10 km/h -> blows west: u≈-10, v≈0
    worker.httpx = _fake_httpx(
        {"cloud_cover": 50, "wind_speed_10m": 10, "wind_direction_10m": 90, "precipitation": 0}, box)
    worker.cycle()
    grid = cap["grid"]
    assert math.isclose(grid["u"][0], -10.0, abs_tol=0.01)
    assert abs(grid["v"][0]) < 0.01


def test_worker_batches_grid_into_chunks():
    box, cap = {}, _prep(step=180, batch=1)  # 2 nodes, batch 1 => 2 calls, one blob
    worker.httpx = _fake_httpx(
        {"cloud_cover": 10, "wind_speed_10m": 5, "wind_direction_10m": 0, "precipitation": 0}, box)
    worker.cycle()
    assert box["calls"] == 2
    assert len(cap["grid"]["cloud"]) == 2  # both chunks -> one packed blob


def test_worker_never_writes_to_scoring_spine():
    box, cap = {}, _prep(step=180)
    worker.httpx = _fake_httpx(
        {"cloud_cover": 30, "wind_speed_10m": 8, "wind_direction_10m": 45, "precipitation": 1.2}, box)
    worker.cycle()
    assert cap["obs"] == 0 and cap["dyads"] == 0   # isolated: no observation/dyad rows


def test_worker_outage_is_non_fatal():
    cap = _prep(step=180)

    class _Boom:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            raise RuntimeError("open-meteo down")

    worker.httpx = types.SimpleNamespace(Client=_Boom)
    # scheduler wraps each cycle in _safe: an outage is logged, never crashes, and the
    # last cached blob is left in place (no upsert on failure).
    scheduler._safe("weather-field", worker.cycle)
    assert cap["grid"] is None  # nothing written this cycle


def test_worker_skips_on_empty_bucket():
    cap = _prep(step=180)
    worker.bucket.take = lambda max_wait=20: False
    worker.cycle()
    assert cap["grid"] is None  # quota exhausted -> clean skip, last blob preserved


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
