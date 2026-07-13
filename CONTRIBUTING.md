# Contributing to GeoPulse

Thanks for taking the time to contribute! This guide covers how to get a dev
environment running, the conventions the project follows, and what a good pull
request looks like.

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/groscy/geopulse/issues/new?template=bug_report.yml).
- **Request a feature** — open a [feature request](https://github.com/groscy/geopulse/issues/new?template=feature_request.yml).
- **Improve docs** — fixes to `README.md`, [`ARCHITECTURE.md`](ARCHITECTURE.md),
  or [`docs/arc42.md`](docs/arc42.md) are always welcome.
- **Send code** — pick up an open issue or propose a change (see below).

## Project layout

| Path         | What lives here                                                        |
| ------------ | --------------------------------------------------------------------- |
| `services/`  | Python backend — API (FastAPI), ingestion workers, scoring engine     |
| `frontend/`  | React + TypeScript + Vite single-page app (the globe UI)              |
| `db/`        | SQL migrations applied on boot                                        |
| `docker/`    | Entrypoints, supervisord, nginx for the all-in-one image             |
| `openspec/`  | Spec-driven change proposals (see [Proposing a change](#proposing-a-change)) |
| `docs/`      | Architecture documentation                                            |

## Development setup

### Backend (Python)

```sh
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r services/requirements.txt pytest
pytest services/tests                              # run the test suite
```

### Frontend (Node)

Requires Node 20+.

```sh
npm --prefix frontend ci
npm --prefix frontend run dev         # Vite dev server against a running API
npm --prefix frontend run typecheck   # tsc type-check, no emit
npm --prefix frontend run build       # production build
```

### Full stack

The multi-container compose file runs each service in its own container:

```sh
docker compose up --build             # or: podman compose up --build
```

See the [README](README.md#development) for the single all-in-one image.

## Proposing a change

Non-trivial changes are tracked with [OpenSpec](https://github.com/Fission-AI/OpenSpec)
under `openspec/`. Before large work, open a proposal so the design is reviewed
before implementation. Small fixes (typos, obvious bugs) don't need one — just
open a PR.

## Pull requests

1. **Branch** off `main` (`fix/…`, `feat/…`, `docs/…`).
2. **Keep it focused** — one logical change per PR.
3. **Verify locally** before pushing:
   - `pytest services/tests` passes
   - `npm --prefix frontend run typecheck` and `npm --prefix frontend run build` pass
4. **Write a clear description** — what changed and why. Link the issue it closes.
5. CI must be green before review.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/), matching the
existing history:

```
feat(globe): render cyclones as baked volumetric hurricane clouds
fix(frontend): add @types/node so vite.config.ts type-checks
chore(frontend): bump vite 5.4 -> 7.3
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. See
[SECURITY.md](SECURITY.md) for how to report privately.

## Code of Conduct

By participating you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
