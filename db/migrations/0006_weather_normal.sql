-- GeoPulse — capability: scoring-engine / data-ingestion (climatology baselines).
-- Day-of-year climatological normals (mean + sd) per country/metric, computed once
-- from multi-year Open-Meteo archive data. Quasi-static reference data, ISOLATED from
-- the live `observation` hypertable so it does not affect coverage/staleness math.
CREATE TABLE IF NOT EXISTS weather_normal (
    country char(3)          NOT NULL,
    metric  text             NOT NULL,
    doy     int              NOT NULL,   -- day of year, 1..366
    mean    double precision NOT NULL,
    sd      double precision NOT NULL,
    PRIMARY KEY (country, metric, doy)
);
