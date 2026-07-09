"""Minimal structured logging setup shared by services."""
from __future__ import annotations

import logging
import os


def get_logger(name: str) -> logging.Logger:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger(name)
