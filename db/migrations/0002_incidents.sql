-- GeoPulse M2 — capabilities: incident-detection.
-- Hysteresis state memory + incident lifecycle.

-- Per-(country, domain) hysteresis memory: committed state + candidate + counter.
CREATE TABLE IF NOT EXISTS domain_state (
    country          char(3)     NOT NULL,
    domain           text        NOT NULL,
    committed_state  text        NOT NULL,
    candidate_state  text,
    candidate_count  int         NOT NULL DEFAULT 0,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (country, domain)
);

-- Incidents opened by the threshold detector.
CREATE TABLE IF NOT EXISTS incident (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key   text        NOT NULL,        -- country:domain — one active per key
    severity    text        NOT NULL,        -- degraded | disrupted
    countries   char(3)[]   NOT NULL,
    metric      text,
    threshold   text,
    started_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    title       text        NOT NULL,
    detail      jsonb
);
CREATE INDEX IF NOT EXISTS incident_started ON incident (started_at DESC);
CREATE INDEX IF NOT EXISTS incident_resolved ON incident (resolved_at);
CREATE INDEX IF NOT EXISTS incident_countries ON incident USING GIN (countries);
-- at most one active (unresolved) incident per dedup_key
CREATE UNIQUE INDEX IF NOT EXISTS incident_active_dedup
    ON incident (dedup_key) WHERE resolved_at IS NULL;
