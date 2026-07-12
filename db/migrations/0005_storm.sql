-- GeoPulse Phase 4 — capability: storm-tracks.
-- Single-row cache for the active tropical-cyclone set (position/category/track).
-- Feature data with NO per-country z-score — isolated from observation/score. The
-- storm-worker overwrites the one row (id = 1) each cycle and opens/resolves
-- country:storm rows in the existing `incident` table.
CREATE TABLE IF NOT EXISTS storm (
    id         int PRIMARY KEY DEFAULT 1,
    storms     jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT storm_singleton CHECK (id = 1)
);
