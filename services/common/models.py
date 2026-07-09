"""Canonical data shapes every worker normalizes into."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Observation:
    """A single point observation (worker normalization contract)."""

    country: str        # ISO-3166-1 alpha-3
    metric: str
    value: float
    ts: datetime        # timezone-aware (UTC)
    source: str
    confidence: float = 1.0


@dataclass(frozen=True)
class DyadObservation:
    """A bilateral/directional observation (e.g. gdelt_tone)."""

    country_a: str
    country_b: str
    metric: str
    value: float
    ts: datetime
    source: str
