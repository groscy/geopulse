-- GeoPulse Phase 3 — capability: weather-field.
-- Single-row cache for the ambient global atmospheric-field grid (cloud/wind/precip).
-- Deliberately ISOLATED from observation/score/incident: field data has no country
-- and no z-score, and never flows through the scoring spine. The weather-field-worker
-- overwrites the one row (id = 1) each cycle; the API serves it as a single blob.
CREATE TABLE IF NOT EXISTS weather_field (
    id         int PRIMARY KEY DEFAULT 1,
    grid       jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT weather_field_singleton CHECK (id = 1)
);
