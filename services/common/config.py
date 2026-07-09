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


# which metrics roll up into each domain (relations is dyad-based, handled apart)
DOMAIN_METRICS: dict[str, list[str]] = {
    "markets": ["equity_index", "fx_usd"],
    "economy": ["macro_cpi", "macro_gdp_growth", "macro_debt_gdp"],
}
# per-domain, per-metric weights for the staleness-discounted rollup.
WEIGHTS: dict[str, dict[str, float]] = {
    "markets": {"equity_index": 1.0, "fx_usd": 0.5},
    "economy": {"macro_cpi": 1.0, "macro_gdp_growth": 1.0, "macro_debt_gdp": 0.7},
    "relations": {"gdelt_tone": 1.0},
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

API_CORS_ORIGINS = _env(
    "API_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
).split(",")
