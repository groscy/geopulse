# GeoPulse

A local-first geopolitical risk dashboard: ingestion workers pull markets, FX,
GDELT events, and macro indicators into a TimescaleDB store, a scoring engine
turns them into per-country risk states, and a React globe visualizes them live.

> **How it fits together:** [ARCHITECTURE.md](ARCHITECTURE.md) for a quick component
> diagram and data flow; [docs/arc42.md](docs/arc42.md) for the full architecture
> documentation (arc42) — goals, constraints, decisions, quality scenarios, and risks.

## Run it — single all-in-one image

Everything (database, workers, scoring engine, API, and web UI) ships in **one
container image**. It needs no external services; just build and run.

```sh
# Docker
docker build -t geopulse .
docker run -d --name geopulse -p 8080:80 -v geopulse-data:/var/lib/postgresql/data geopulse

# Podman (equivalent)
podman build -t geopulse .
podman run -d --name geopulse -p 8080:80 -v geopulse-data:/var/lib/postgresql/data geopulse
```

Then open **http://localhost:8080**.

- `-p 8080:80` — the UI (and the API under `/api/`) are served on port 80; map it wherever you like.
- `-v geopulse-data:/var/lib/postgresql/data` — persists the database across restarts. Omit it for a throwaway run.

On first boot the container initializes Postgres, applies migrations, and starts
all services. Give the workers a few minutes to fetch data and the scoring
engine to compute the first states.

### Live market data (optional)

The markets worker uses a free [Twelve Data](https://twelvedata.com/pricing) API
key. Without it the app runs fine — country states are still computed from GDELT,
FX, and macro sources; the equity metric just stays empty.

```sh
docker run -d --name geopulse -p 8080:80 \
  -e TWELVE_DATA_KEY=your_key_here \
  -v geopulse-data:/var/lib/postgresql/data geopulse
```

Other tunables (all optional, with sensible defaults): `MARKETS_INTERVAL`,
`GDELT_INTERVAL`, `SCORING_INTERVAL`, `FX_INTERVAL`, `MACRO_INTERVAL`,
`MARKETS_BACKFILL_DAYS`. See [.env.example](.env.example).

### Manage it

```sh
docker logs -f geopulse     # follow all service logs
docker stop geopulse        # stop
docker start geopulse       # start again (data preserved via the volume)
docker rm -f geopulse       # remove the container (named volume survives)
```

## What's inside the image

One container, all processes under [supervisord](docker/supervisord.conf):

| Process          | Role                                                              |
| ---------------- | ---------------------------------------------------------------- |
| `postgres`       | TimescaleDB — the observation + score store                      |
| `migrate`        | one-shot: applies `db/migrations/*.sql`, then unblocks the rest  |
| `markets-worker` | equity-index ETFs via Twelve Data                                |
| `fx-worker`      | USD exchange rates (keyless)                                      |
| `gdelt-worker`   | GDELT event tone (keyless)                                       |
| `macro-worker`   | World Bank macro indicators (keyless)                            |
| `weather-worker` | Open-Meteo per-country temp / precip / wind (keyless)            |
| `weather-field-worker` | Open-Meteo global cloud / wind field grid (keyless)        |
| `storm-worker`   | NHC live tropical cyclones → storm spirals + incidents (keyless) |
| `scoring-engine` | rolls observations up into per-country risk states               |
| `api`            | FastAPI REST + SSE on `127.0.0.1:8000`                           |
| `nginx`          | serves the SPA and reverse-proxies `/api/` to the API (port 80)  |

The app services wait for Postgres **and** a completed migration before they
start, so the stack comes up cleanly in any order.

## Development

For iterating on individual services, the multi-container
[docker-compose.yml](docker-compose.yml) runs each in its own container with live
config, and the frontend has its own Vite dev server:

```sh
docker compose up --build          # full stack, service-per-container
npm --prefix frontend run dev      # frontend only, against a running API
```
