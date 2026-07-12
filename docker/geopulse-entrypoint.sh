#!/bin/sh
# All-in-one entrypoint. Fills in the database credential defaults at RUNTIME
# instead of baking them into image ENV layers -- Docker's SecretsUsedInArgOrEnv
# rule flags a secret in ENV, and a hardcoded DATABASE_URL can't pick up an
# overridden password anyway.
#
# Override any of these at `docker run` time with -e:
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
#     -> used by Postgres on first init AND to build the connection string.
#   DATABASE_URL
#     -> pass explicitly to bypass the derivation (e.g. a password containing
#        URL-reserved characters like @ : / that wouldn't survive interpolation).
set -eu

: "${POSTGRES_USER:=geopulse}"
: "${POSTGRES_PASSWORD:=geopulse}"
: "${POSTGRES_DB:=geopulse}"
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB

: "${DATABASE_URL:=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}}"
export DATABASE_URL

# supervisord becomes PID 1 (exec) and passes this environment to every child:
# the Postgres entrypoint, the migration one-shot, the workers, and the API.
exec supervisord -c /etc/supervisord.conf
