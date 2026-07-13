# GeoPulse — all-in-one image.
#
# One container runs the whole app under supervisord:
#   TimescaleDB  ->  migrations  ->  ingestion workers + scoring + FastAPI  ->  nginx (SPA + /api proxy)
#
# Build:  docker build -t geopulse .
# Run:    docker run -p 8080:80 -v geopulse-data:/var/lib/postgresql/data geopulse
# Then open http://localhost:8080  (add -e TWELVE_DATA_KEY=... for live market data).

# ---- stage 1: build the Vite frontend ----
FROM node:26-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin: the SPA calls /api/... which nginx proxies to the local API.
ARG VITE_API_BASE=/
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ---- stage 2: runtime (Postgres + TimescaleDB + Python services + nginx) ----
FROM timescale/timescaledb:latest-pg16

# DB credentials are NOT set here: a secret in ENV is flagged by Docker's
# SecretsUsedInArgOrEnv rule, and a baked DATABASE_URL can't follow an overridden
# password. geopulse-entrypoint.sh fills POSTGRES_PASSWORD / DATABASE_URL in at
# runtime (defaulting to geopulse, overridable with -e).
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    MIGRATIONS_DIR=/app/db/migrations \
    POSTGRES_USER=geopulse \
    POSTGRES_DB=geopulse \
    PGDATA=/var/lib/postgresql/data

# Python runtime, web server, process supervisor.
RUN apk add --no-cache python3 py3-pip nginx supervisor \
 && ln -sf "$(command -v python3)" /usr/local/bin/python

WORKDIR /app
COPY services/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /app/requirements.txt

# Application code (common, api, *-worker, scoring-engine) and baked-in migrations.
COPY services /app
COPY db /app/db

# Built SPA served by nginx.
COPY --from=frontend /app/dist /srv/geopulse

# Web + process management.
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/geopulse-entrypoint.sh /usr/local/bin/geopulse-entrypoint.sh
COPY docker/geopulse-run.sh /usr/local/bin/geopulse-run.sh
COPY docker/geopulse-migrate.sh /usr/local/bin/geopulse-migrate.sh
RUN chmod +x /usr/local/bin/geopulse-entrypoint.sh /usr/local/bin/geopulse-run.sh /usr/local/bin/geopulse-migrate.sh

# Only nginx is published; the API and DB stay on localhost inside the container.
EXPOSE 80
# Postgres data persists here — mount a volume to keep it across runs.
VOLUME ["/var/lib/postgresql/data"]

# Reset the base image's postgres entrypoint. The wrapper sets the DB credential
# defaults, then exec's supervisord as PID 1.
ENTRYPOINT ["/usr/local/bin/geopulse-entrypoint.sh"]
