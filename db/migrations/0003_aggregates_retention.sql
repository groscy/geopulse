-- GeoPulse M4 — capability: data-retention.
-- Continuous aggregate for hot baseline reads + selective retention.

-- Daily per-(country, metric) rolling stats — cheaper baseline reads than
-- rescanning the raw hypertable each scoring cycle.
CREATE MATERIALIZED VIEW IF NOT EXISTS observation_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', ts) AS bucket,
       country, metric,
       avg(value) AS avg_value,
       count(*)   AS n
FROM observation
GROUP BY bucket, country, metric
WITH NO DATA;

-- refresh recent buckets frequently (kept tight vs the scoring cadence).
SELECT add_continuous_aggregate_policy('observation_daily',
    start_offset     => INTERVAL '120 days',
    end_offset       => INTERVAL '1 hour',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists    => TRUE);

-- Retention. dyad_observation is entirely high-frequency -> drop chunks past 90d.
SELECT add_retention_policy('dyad_observation', INTERVAL '90 days', if_not_exists => TRUE);

-- observation holds high-frequency (equity/fx) AND slow structural macro in one
-- hypertable, so a time-based drop_chunks would delete decades of macro history.
-- Prune only the high-frequency metrics; macro_* and the continuous aggregate are preserved.
CREATE OR REPLACE PROCEDURE prune_highfreq(job_id int, config jsonb)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM observation
    WHERE metric IN ('equity_index', 'fx_usd')
      AND ts < now() - INTERVAL '90 days';
END;
$$;
SELECT add_job('prune_highfreq', INTERVAL '1 day');
