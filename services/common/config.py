"""Environment-driven configuration shared by all services."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


DATABASE_URL = _env(
    "DATABASE_URL", "postgresql://geopulse:geopulse@db:5432/geopulse"
)

# --- cadences (seconds) ---
# Daily EOD ETF data only updates once/day; the free Twelve Data tier is 8/min &
# 800/day. Poll hourly by default to stay within quota (kickstart risk R-1) — a
# real-time provider would run at <=5 min (NFR-2).
MARKETS_INTERVAL = _int("MARKETS_INTERVAL", 3600)
GDELT_INTERVAL = _int("GDELT_INTERVAL", 900)       # 15 min
SCORING_INTERVAL = _int("SCORING_INTERVAL", 300)   # 5 min

# --- markets provider ---
# Twelve Data free tier gives daily history (needed for 90d baselines).
TWELVE_DATA_KEY = _env("TWELVE_DATA_KEY", "").strip()
MARKETS_BACKFILL_DAYS = _int("MARKETS_BACKFILL_DAYS", 120)

# Country -> equity instrument (US-listed country-equity ETF proxies work on the
# Twelve Data free tier and track each country's equity market). metric='equity_index'.
INDEX_SYMBOLS: list[dict[str, str]] = [
    {"iso3": "USA", "symbol": "SPY", "name": "US large-cap"},
    {"iso3": "JPN", "symbol": "EWJ", "name": "Japan"},
    {"iso3": "DEU", "symbol": "EWG", "name": "Germany"},
    {"iso3": "FRA", "symbol": "EWQ", "name": "France"},
    {"iso3": "CHE", "symbol": "EWL", "name": "Switzerland"},
    {"iso3": "GBR", "symbol": "EWU", "name": "United Kingdom"},
    {"iso3": "CHN", "symbol": "MCHI", "name": "China"},
    {"iso3": "BRA", "symbol": "EWZ", "name": "Brazil"},
    {"iso3": "ARG", "symbol": "ARGT", "name": "Argentina"},
    {"iso3": "IND", "symbol": "INDA", "name": "India"},
    {"iso3": "KOR", "symbol": "EWY", "name": "South Korea"},
    {"iso3": "CAN", "symbol": "EWC", "name": "Canada"},
]

# --- GDELT ---
GDELT_MIN_EVENTS = _int("GDELT_MIN_EVENTS", 5)  # min events per dyad per window (R-2)
# min article/event count per country per window before a news point obs is emitted
# (the per-country analogue of GDELT_MIN_EVENTS; suppresses thin-coverage noise).
GDELT_MIN_COUNTRY_ARTICLES = _int("GDELT_MIN_COUNTRY_ARTICLES", 3)

# --- scoring ---
BASELINE_DAYS = _int("BASELINE_DAYS", 90)
CLAMP_Z = 4.0
# per-metric staleness time-constant tau (seconds). Equity EOD is 1-3d old; gdelt
# 3d; macro is ANNUAL (World Bank latest lags ~1-2y) so tau is ~2.7y; fx ~1d.
DAY = 24 * 3600.0
TAU_SECONDS: dict[str, float] = {
    "equity_index": 5 * DAY,
    "gdelt_tone": 3 * DAY,
    "fx_usd": 3 * DAY,
    "macro_cpi": 1000 * DAY,
    "macro_gdp_growth": 1000 * DAY,
    "macro_debt_gdp": 1000 * DAY,
    # per-country news metrics share GDELT's ~3d freshness window (15-min cadence,
    # but a country may not appear in every export window).
    "news_tone": 3 * DAY,
    "news_goldstein": 3 * DAY,
    "news_volume": 3 * DAY,
    # surface temperature is sampled hourly and is genuinely fresh; ~1d τ so a
    # stalled weather-worker discounts to stale within a day. Precip and wind share
    # the same hourly cadence and ~1d freshness window.
    "weather_temp": 1 * DAY,
    "weather_precip": 1 * DAY,
    "weather_wind": 1 * DAY,
    # drought is a slow, long-window signal — a few days of precip freshness is fine.
    "weather_drought": 3 * DAY,
}
DEFAULT_TAU = 2 * DAY
# per-metric baseline lookback (days). Macro needs decades of annual points.
BASELINE_DAYS_BY_METRIC: dict[str, int] = {
    "macro_cpi": 365 * 45,
    "macro_gdp_growth": 365 * 45,
    "macro_debt_gdp": 365 * 45,
}
# per-metric min baseline points (annual macro has fewer than daily markets).
MIN_BASELINE_BY_METRIC: dict[str, int] = {
    "macro_cpi": 12, "macro_gdp_growth": 12, "macro_debt_gdp": 12,
}
# min fraction of expected/fresh inputs before a domain is scored (else stale).
COVERAGE_MIN = 0.5
# min baseline points required to trust a z-score (default; overridden per metric).
MIN_BASELINE_POINTS = _int("MIN_BASELINE_POINTS", 20)

# --- hysteresis (M2, NFR-4) ---
# a state must hold for N consecutive evaluations before it commits.
HYSTERESIS_N = _int("HYSTERESIS_N", 3)
# asymmetric bands: enter a worse state at |z| >= ENTER, recover below RECOVER.
ENTER_DEGRADED = 1.0
RECOVER_DEGRADED = 0.7   # degraded -> operational below this
ENTER_DISRUPTED = 2.0
RECOVER_DISRUPTED = 1.7  # disrupted -> degraded below this


# which metrics roll up into each domain (relations is dyad-based, handled apart).
# `news` is a standalone point-based domain: scored like the others but EXCLUDED
# from the worst-of composite (see scoring-engine.composite_of).
DOMAIN_METRICS: dict[str, list[str]] = {
    "markets": ["equity_index", "fx_usd"],
    "economy": ["macro_cpi", "macro_gdp_growth", "macro_debt_gdp"],
    "news": ["news_tone", "news_goldstein", "news_volume"],
    # standalone meteorological facets — each a self-relative single-metric anomaly.
    # Registering each hazard as its own single-metric domain makes score_domain's
    # weighted mean degenerate to that metric's z (no cross-hazard blending) and
    # gives per-facet hysteresis and per-facet incidents for free. All excluded from
    # the composite (like news); see scoring-engine.COMPOSITE_DOMAINS.
    "weather_temp": ["weather_temp"],
    "weather_precip": ["weather_precip"],
    "weather_wind": ["weather_wind"],
}
# the weather facet domains (single-metric, standalone). Used by the scoring loop
# and INCIDENT_DOMAINS so a new facet is added in one place.
WEATHER_FACETS: list[str] = ["weather_temp", "weather_precip", "weather_wind"]
# per-domain, per-metric weights for the staleness-discounted rollup.
WEIGHTS: dict[str, dict[str, float]] = {
    "markets": {"equity_index": 1.0, "fx_usd": 0.5},
    "economy": {"macro_cpi": 1.0, "macro_gdp_growth": 1.0, "macro_debt_gdp": 0.7},
    "relations": {"gdelt_tone": 1.0},
    "news": {"news_tone": 1.0, "news_goldstein": 1.0, "news_volume": 0.5},
    "weather_temp": {"weather_temp": 1.0},
    "weather_precip": {"weather_precip": 1.0},
    "weather_wind": {"weather_wind": 1.0},
}

# --- macro (World Bank, keyless) ---
MACRO_INTERVAL = _int("MACRO_INTERVAL", 24 * 3600)  # daily
MACRO_HISTORY_FROM = _int("MACRO_HISTORY_FROM", 1980)
# canonical metric -> World Bank indicator code
WB_INDICATORS: dict[str, str] = {
    "macro_cpi": "FP.CPI.TOTL.ZG",          # inflation, consumer prices (annual %)
    "macro_gdp_growth": "NY.GDP.MKTP.KD.ZG",  # GDP growth (annual %)
    "macro_debt_gdp": "GC.DOD.TOTL.GD.ZS",   # central govt debt (% of GDP)
}
MACRO_COUNTRIES: list[str] = [
    "USA", "CAN", "MEX", "BRA", "ARG", "CHL", "COL", "PER",
    "GBR", "DEU", "FRA", "ITA", "ESP", "NLD", "CHE", "SWE", "NOR", "DNK",
    "FIN", "POL", "BEL", "AUT", "IRL", "PRT", "GRC", "CZE", "HUN", "ROU",
    "RUS", "UKR", "TUR", "CHN", "JPN", "KOR", "IND", "IDN", "THA", "MYS",
    "PHL", "VNM", "SGP", "PAK", "BGD", "AUS", "NZL", "ZAF", "NGA", "EGY",
    "SAU", "ARE", "ISR", "IRN", "QAT",
]

# --- fx (open.er-api.com, keyless; exchangerate.host now needs a key) ---
FX_INTERVAL = _int("FX_INTERVAL", 15 * 60)  # ~15 min
FX_BASE = _env("FX_BASE", "https://open.er-api.com/v6/latest/USD")
# currency code -> countries (ISO-3) using it vs USD
FX_CURRENCY_COUNTRIES: dict[str, list[str]] = {
    "EUR": ["DEU", "FRA", "ITA", "ESP", "NLD", "BEL", "AUT", "IRL", "PRT", "GRC", "FIN"],
    "GBP": ["GBR"], "JPY": ["JPN"], "CHF": ["CHE"], "CNY": ["CHN"], "CAD": ["CAN"],
    "AUD": ["AUS"], "NZD": ["NZL"], "SEK": ["SWE"], "NOK": ["NOR"], "DKK": ["DNK"],
    "PLN": ["POL"], "CZK": ["CZE"], "HUF": ["HUN"], "RON": ["ROU"], "TRY": ["TUR"],
    "RUB": ["RUS"], "UAH": ["UKR"], "BRL": ["BRA"], "MXN": ["MEX"], "ARS": ["ARG"],
    "CLP": ["CHL"], "COP": ["COL"], "PEN": ["PER"], "KRW": ["KOR"], "INR": ["IND"],
    "IDR": ["IDN"], "THB": ["THA"], "MYR": ["MYS"], "PHP": ["PHL"], "VND": ["VNM"],
    "SGD": ["SGP"], "PKR": ["PAK"], "BDT": ["BGD"], "ZAR": ["ZAF"], "NGN": ["NGA"],
    "EGP": ["EGY"], "SAR": ["SAU"], "AED": ["ARE"], "ILS": ["ISR"], "QAR": ["QAT"],
}

# --- weather (Open-Meteo, keyless) ---
# Current temperature, precipitation, and wind sampled at each country's
# representative point; each scored self-relative (a per-country anomaly) as its
# own single-metric facet domain and shown on the Meteorological overlay (temp =
# 7-day mean, precip = 7-day total, wind = 7-day max). Hourly cadence — Open-Meteo
# current-conditions refresh ~hourly.
WEATHER_INTERVAL = _int("WEATHER_INTERVAL", 3600)
OPEN_METEO_BASE = _env("OPEN_METEO_BASE", "https://api.open-meteo.com/v1/forecast")
# committed facet state at/above which a country opens a `country:<facet>` incident.
# Default `disrupted` (|z| >= 2) per facet so only genuine extremes reach the feed —
# degraded (|z| 1-2) swings vs a drifting baseline are noisy.
WEATHER_INCIDENT_FLOOR = _env("WEATHER_INCIDENT_FLOOR", "disrupted").strip()
WEATHER_INCIDENT_FLOORS: dict[str, str] = {f: WEATHER_INCIDENT_FLOOR for f in WEATHER_FACETS}
WEATHER_INCIDENT_FLOORS["weather_drought"] = WEATHER_INCIDENT_FLOOR  # dry-tail facet
# per-metric directionality for the four-state mapping. `both` escalates on either
# tail via abs(z) (temperature: heat AND cold). `high` escalates only on the
# positive tail (flood, gale); the non-hazard low tail clamps to operational.
SIDED: dict[str, str] = {
    "weather_temp": "both",
    "weather_precip": "high",
    "weather_wind": "high",
    "weather_drought": "low",  # only a rainfall DEFICIT escalates
}
# per-metric variance-stabilizing transform applied ONLY inside the z computation
# (raw values stay stored/displayed). `log1p` tames precipitation's right-skewed,
# zero-inflated distribution so a Gaussian z on the baseline is meaningful. Superseded
# for precip by the empirical-CDF percentile when PRECIP_PERCENTILE is on.
METRIC_TRANSFORM: dict[str, str] = {
    "weather_precip": "log1p",
}

# --- weather climatology (Open-Meteo archive, keyless) — day-of-year normals ---
# Removes the 90-day self-window's seasonal drift AND warms up immediately (a normal
# plus one recent observation is enough, no 20-point baseline wait). Precip uses a
# percentile anomaly instead of a Gaussian-climatology z; drought is a long-window
# accumulation deficit vs the climatological normal.
OPEN_METEO_ARCHIVE = _env("OPEN_METEO_ARCHIVE", "https://archive-api.open-meteo.com/v1/archive")
CLIMO_YEARS = _int("CLIMO_YEARS", 5)              # years of history behind each normal
CLIMO_WINDOW_DAYS = _int("CLIMO_WINDOW_DAYS", 5)  # ±days smoothing around the day-of-year
# backfill is one-time and gentle: a modest batch per cycle with a pause between
# archive requests, so the keyless archive API isn't rate-limited (429). Missing
# countries retry on the next cycle until all are covered.
CLIMO_BACKFILL_PER_CYCLE = _int("CLIMO_BACKFILL_PER_CYCLE", 15)
CLIMO_BACKFILL_SLEEP = float(_env("CLIMO_BACKFILL_SLEEP", "3"))  # seconds between archive requests
# metrics scored against the day-of-year climatology when a normal exists (else the
# 90-day self-window). Only temperature: its daily-MEAN normal matches a daily-mean of
# observations. Wind's archive normal is a daily MAX (not comparable to instantaneous
# readings) and precip uses the percentile anomaly, so both keep the self-window.
CLIMATOLOGY_METRICS = {"weather_temp"}
# a daily-mean anomaly needs a full diurnal cycle of observations; below this many
# hours of recent coverage the climatology z is untrustworthy and the facet stays stale.
CLIMO_MIN_SPAN_HOURS = _int("CLIMO_MIN_SPAN_HOURS", 20)
# precip anomaly via empirical-CDF percentile (replaces the log1p-Gaussian z).
PRECIP_PERCENTILE = _env("PRECIP_PERCENTILE", "1").strip() not in ("", "0", "false")
# drought: precip accumulation deficit vs climatology over a long window (low-sided).
DROUGHT_WINDOW_DAYS = _int("DROUGHT_WINDOW_DAYS", 90)
# ISO-3 -> representative point (lat, lon): capital coordinates, one sample per
# country. A single point is a deliberate v1 simplification — the signal is a
# self-relative anomaly at a fixed point; spatial nuance is the field-shell phase.
WEATHER_POINTS: dict[str, tuple[float, float]] = {
    "USA": (38.9, -77.0), "CAN": (45.4, -75.7), "MEX": (19.4, -99.1), "BRA": (-15.8, -47.9),
    "ARG": (-34.6, -58.4), "CHL": (-33.4, -70.7), "COL": (4.7, -74.1), "PER": (-12.0, -77.0),
    "GBR": (51.5, -0.1), "DEU": (52.5, 13.4), "FRA": (48.9, 2.3), "ITA": (41.9, 12.5),
    "ESP": (40.4, -3.7), "NLD": (52.4, 4.9), "CHE": (46.9, 7.4), "SWE": (59.3, 18.1),
    "NOR": (59.9, 10.8), "DNK": (55.7, 12.6), "FIN": (60.2, 24.9), "POL": (52.2, 21.0),
    "BEL": (50.8, 4.4), "AUT": (48.2, 16.4), "IRL": (53.3, -6.3), "PRT": (38.7, -9.1),
    "GRC": (38.0, 23.7), "CZE": (50.1, 14.4), "HUN": (47.5, 19.0), "ROU": (44.4, 26.1),
    "RUS": (55.8, 37.6), "UKR": (50.5, 30.5), "TUR": (39.9, 32.9), "CHN": (39.9, 116.4),
    "JPN": (35.7, 139.7), "KOR": (37.6, 127.0), "IND": (28.6, 77.2), "IDN": (-6.2, 106.8),
    "THA": (13.8, 100.5), "MYS": (3.1, 101.7), "PHL": (14.6, 121.0), "VNM": (21.0, 105.8),
    "SGP": (1.35, 103.8), "PAK": (33.7, 73.1), "BGD": (23.8, 90.4), "AUS": (-35.3, 149.1),
    "NZL": (-41.3, 174.8), "ZAF": (-25.7, 28.2), "NGA": (9.1, 7.5), "EGY": (30.0, 31.2),
    "SAU": (24.7, 46.7), "ARE": (24.5, 54.4), "ISR": (31.8, 35.2), "IRN": (35.7, 51.4),
    "QAT": (25.3, 51.5),
}

# --- weather field (Open-Meteo, keyless) — Phase 3 ambient atmospheric shell ---
# A coarse GLOBAL grid of {cloud%, wind u/v, precip} fetched on a slow cadence and
# cached as one blob. NOT per-country, NOT scored — a decorative field layer only
# (the Meteorological overlay's lifted cloud shell); never touches the scoring spine.
WEATHER_FIELD_INTERVAL = _int("WEATHER_FIELD_INTERVAL", 3 * 3600)  # ~3h; field drifts slowly
# grid: step (deg) over a clamped latitude band where the orthographic projection is
# well-behaved. Finer (~10° => ~500 nodes) for the continuous cloud render; the field
# is served packed (columnar) so the denser grid stays cheap over the wire.
WEATHER_FIELD_STEP = _int("WEATHER_FIELD_STEP", 10)
WEATHER_FIELD_LAT_MIN = _int("WEATHER_FIELD_LAT_MIN", -60)
WEATHER_FIELD_LAT_MAX = _int("WEATHER_FIELD_LAT_MAX", 75)
# max coordinates per batched Open-Meteo request; a cycle splits the grid into chunks
# to stay within the provider's per-request coordinate limit.
WEATHER_FIELD_BATCH = _int("WEATHER_FIELD_BATCH", 100)

# --- storm tracks (NOAA NHC, keyless) — Phase 4 live tropical cyclones ---
# Active cyclones from the NHC CurrentStorms feed (Atlantic + East Pacific), cached
# as one blob and mapped to threatened countries -> country:storm incidents. Feature
# data only (no per-country z-score), never touches the scoring spine.
STORM_INTERVAL = _int("STORM_INTERVAL", 3 * 3600)  # ~3h; advisories refresh ~6h
NHC_CURRENT_STORMS = _env("NHC_CURRENT_STORMS", "https://www.nhc.noaa.gov/CurrentStorms.json")
# spatial hysteresis: a storm THREATENS a country within OPEN km, and only CLEARS it
# beyond RESOLVE km (> OPEN), so a system skirting the boundary doesn't flap.
STORM_OPEN_KM = _int("STORM_OPEN_KM", 500)
STORM_RESOLVE_KM = _int("STORM_RESOLVE_KM", 800)
# Saffir-Simpson category (from max sustained wind, kt) at/above which a storm's
# incident is `disrupted`; weaker systems open `degraded`.
STORM_DISRUPTED_CAT = _int("STORM_DISRUPTED_CAT", 3)

API_CORS_ORIGINS = _env(
    "API_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
).split(",")
