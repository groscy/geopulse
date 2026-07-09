# Shared image for all Python services (workers, scoring, api, migrate).
# Build context is the REPO ROOT so we can bake db/migrations into the image
# (avoids runtime bind mounts, which are unreliable on Podman/WSL on Windows).
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    MIGRATIONS_DIR=/app/db/migrations

COPY services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# service packages (common, markets-worker, gdelt-worker, scoring-engine, api)
COPY services /app
# migrations, baked in so the migrate service needs no host mount
COPY db /app/db

# Default command is overridden per-service in docker-compose.yml.
CMD ["python", "-c", "print('set a command in docker-compose.yml')"]
