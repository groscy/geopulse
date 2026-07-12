#!/bin/sh
# One-shot migration step. Waits for Postgres, applies db/migrations/*.sql (the
# runner is idempotent), then touches the marker that gates the app processes.
set -eu

until pg_isready -h 127.0.0.1 -p 5432 -U "${POSTGRES_USER:-geopulse}" -q 2>/dev/null; do
    sleep 1
done

mkdir -p /run/geopulse

n=0
until python3 -m common.migrate; do
    n=$((n + 1))
    if [ "$n" -ge 15 ]; then
        echo "geopulse migrate: failed after $n attempts" >&2
        exit 1
    fi
    echo "geopulse migrate: database not ready yet, retry $n" >&2
    sleep 2
done

touch /run/geopulse/migrated
echo "geopulse migrate: complete"
