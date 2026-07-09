-- GeoPulse M1 schema — capability: observation-store.
-- Idempotent: safe to re-run (guarded by the migration ledger + IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Point observations: the canonical landing zone every worker writes to.
CREATE TABLE IF NOT EXISTS observation (
    country     char(3)          NOT NULL,
    metric      text             NOT NULL,
    value       double precision NOT NULL,
    ts          timestamptz      NOT NULL,
    source      text             NOT NULL,
    confidence  real             NOT NULL DEFAULT 1.0,
    PRIMARY KEY (country, metric, ts, source)
);
SELECT create_hypertable('observation', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS observation_cm_ts
    ON observation (country, metric, ts DESC);

-- Bilateral / directional observations (e.g. gdelt_tone per country pair).
CREATE TABLE IF NOT EXISTS dyad_observation (
    country_a  char(3)          NOT NULL,
    country_b  char(3)          NOT NULL,
    metric     text             NOT NULL,
    value      double precision NOT NULL,
    ts         timestamptz      NOT NULL,
    source     text             NOT NULL,
    PRIMARY KEY (country_a, country_b, metric, ts, source)
);
SELECT create_hypertable('dyad_observation', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS dyad_ab_ts
    ON dyad_observation (country_a, country_b, metric, ts DESC);

-- Computed scores with a full decomposition in `inputs` for auditability.
CREATE TABLE IF NOT EXISTS score (
    country      char(3)     NOT NULL,
    domain       text        NOT NULL,   -- economy | markets | relations | composite
    value        real,
    state        text        NOT NULL,   -- operational | degraded | disrupted | stale
    computed_at  timestamptz NOT NULL DEFAULT now(),
    inputs       jsonb,
    PRIMARY KEY (country, domain, computed_at)
);
CREATE INDEX IF NOT EXISTS score_latest
    ON score (country, domain, computed_at DESC);
