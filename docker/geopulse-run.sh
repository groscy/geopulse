#!/bin/sh
# Block until Postgres accepts connections and migrations have completed, then
# exec the given service command. Used by every app process in supervisord so
# workers/API never start against an un-migrated database.
set -eu

until pg_isready -h 127.0.0.1 -p 5432 -U "${POSTGRES_USER:-geopulse}" -q 2>/dev/null; do
    sleep 1
done

while [ ! -f /run/geopulse/migrated ]; do
    sleep 1
done

exec "$@"
