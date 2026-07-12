"""Storm tracks — verification (change: add-storm-tracks).

Exercises the REAL `storm-worker` functions with the Docker-only deps (psycopg /
httpx) stubbed and the DB / network monkeypatched. Confirms the worker parses the
NHC feed, derives category, caches one blob, opens/resolves `country:storm` incidents
with a spatial-hysteresis buffer and category-derived severity, and never writes to
the scoring spine.

Run: `python services/tests/test_storm_tracks.py` (from repo root)
or `python -m pytest services/tests/test_storm_tracks.py`.
"""
import importlib.util
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


worker = _load("storm-worker/main.py", "storm_main")
from common import scheduler  # noqa: E402

POINTS = {"USA": (38.9, -77.0), "MEX": (19.4, -99.1), "JPN": (35.7, 139.7), "CAN": (45.4, -75.7)}


# ---- pure helpers ----
def test_category_from_intensity():
    assert worker._category(120) == (4, "Cat 4")   # major hurricane
    assert worker._category(40) == (0, "Trop. Storm")
    assert worker._category(25) == (0, "Trop. Depression")
    assert worker._category(140)[0] == 5


def test_haversine_sane():
    d = worker._haversine_km((38.9, -77.0), (36.0, -76.0))  # ~DC -> off Carolina coast
    assert 300 < d < 380


# ---- fake DB + network to drive a cycle ----
class _Cursor:
    def __init__(self, sink, rows):
        self.sink, self.rows = sink, rows

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.sink.append((" ".join(sql.split()), params))

    def fetchone(self):
        return None

    def fetchall(self):
        return self.rows


class _Conn:
    def __init__(self, open_storm_dedups):
        self.closed = False
        self.sql: list = []
        self._rows = [(d,) for d in open_storm_dedups]

    def cursor(self):
        return _Cursor(self.sql, self._rows)


def _fake_httpx(active: list):
    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"activeStorms": active}

    class _Client:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url, timeout=None):
            return _Resp()

    return types.SimpleNamespace(Client=_Client)


def _run(active: list, open_storm_dedups=(), points=POINTS):
    conn = _Conn(list(open_storm_dedups))
    worker._conn = conn
    worker.config.WEATHER_POINTS = points
    worker.bucket.take = lambda max_wait=20: True
    worker.faults.check = lambda name: None
    cached = {"storms": None, "obs": 0}
    worker.db.connect = lambda: conn
    worker.db.upsert_storms = lambda c, storms: cached.update(storms=storms)
    worker.db.query = lambda c, sql, params=None: conn._rows  # open storm incidents
    worker.db.upsert_observations = lambda *a, **k: cached.update(obs=cached["obs"] + 1)
    worker.db.upsert_dyads = lambda *a, **k: cached.update(obs=cached["obs"] + 1)
    worker.httpx = _fake_httpx(active)
    worker.cycle()
    return conn, cached


_ALBERTO = {"id": "al012026", "binNumber": "AT1", "name": "Alberto", "classification": "HU",
            "intensity": "120", "latitudeNumeric": 36.0, "longitudeNumeric": -76.0}
_BLAS = {"id": "ep012026", "binNumber": "EP1", "name": "Blas", "classification": "TS",
         "intensity": "40", "latitudeNumeric": 10.0, "longitudeNumeric": -120.0}


def _inserts(conn):
    return [p for sql, p in conn.sql if sql.startswith("INSERT INTO incident")]


def _resolves(conn):
    return [p for sql, p in conn.sql if sql.startswith("UPDATE incident SET resolved_at")]


# ---- 6.1 / 6.2 ----
def test_caches_storms_and_opens_incident():
    conn, cached = _run([_ALBERTO, _BLAS])
    assert cached["storms"] is not None and len(cached["storms"]) == 2
    alberto = next(s for s in cached["storms"] if s["name"] == "Hurricane Alberto")
    assert alberto["category"] == 4 and alberto["categoryLabel"] == "Cat 4"
    ins = _inserts(conn)
    dedups = {p[0]: p[1] for p in ins}          # dedup_key -> severity
    assert dedups.get("USA:storm") == "disrupted"   # Cat-4 near DC
    assert "MEX:storm" not in dedups and "JPN:storm" not in dedups  # far away


def test_severity_by_category():
    # a tropical storm sitting on Mexico City -> degraded (weak system)
    ts_over_mex = {"id": "x", "name": "Nora", "classification": "TS", "intensity": "45",
                   "latitudeNumeric": 19.4, "longitudeNumeric": -99.1}
    conn, _ = _run([ts_over_mex])
    dedups = {p[0]: p[1] for p in _inserts(conn)}
    assert dedups.get("MEX:storm") == "degraded"


def test_departing_storm_resolves():
    # no active storms, but USA has an open storm incident -> it resolves
    conn, cached = _run([], open_storm_dedups=["USA:storm"])
    assert cached["storms"] == []
    assert any(p[0] == "USA:storm" for p in _resolves(conn))


def test_spatial_hysteresis_keeps_between_buffers():
    # a storm ~650 km from Ottawa: within RESOLVE (800) but beyond OPEN (500) -> CAN is
    # kept (not resolved) but not newly opened.
    storm = {"id": "y", "name": "Gale", "classification": "TS", "intensity": "50",
             "latitudeNumeric": 39.5, "longitudeNumeric": -75.7}
    conn, _ = _run([storm], open_storm_dedups=["CAN:storm"], points={"CAN": (45.4, -75.7)})
    assert not any(p[0] == "CAN:storm" for p in _resolves(conn))   # kept open
    assert "CAN:storm" not in {p[0] for p in _inserts(conn)}       # not re-opened here


def test_no_scoring_writes():
    conn, cached = _run([_ALBERTO])
    assert cached["obs"] == 0                                   # no observation/dyad writes
    blob = " ".join(sql for sql, _ in conn.sql).lower()
    assert "observation" not in blob and "insert into score" not in blob


def test_empty_feed_resolves_all():
    conn, cached = _run([], open_storm_dedups=["USA:storm", "MEX:storm"])
    resolved = {p[0] for p in _resolves(conn)}
    assert resolved == {"USA:storm", "MEX:storm"}


def test_outage_is_non_fatal():
    conn = _Conn([])
    worker._conn = conn
    worker.config.WEATHER_POINTS = POINTS
    worker.bucket.take = lambda max_wait=20: True
    worker.faults.check = lambda name: None
    cached = {"storms": None}
    worker.db.upsert_storms = lambda c, storms: cached.update(storms=storms)

    class _Boom:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            raise RuntimeError("nhc down")

    worker.httpx = types.SimpleNamespace(Client=_Boom)
    scheduler._safe("storm", worker.cycle)  # never crashes
    assert cached["storms"] is None          # nothing cached this cycle


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
