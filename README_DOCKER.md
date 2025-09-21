# Shoutout — Docker/Compose Overview

This document explains how the Docker pieces in this repo work together and how to run them in development and production-like setups.

## What Lives Where

- `docker-compose.yml` (repo root): Orchestrates the Shoutout server and the Caddy reverse proxy. Builds the server from the `server/` directory and mounts logs/config/models as bind mounts from your host.
- `server/Dockerfile`: Defines how the server image is built and started (Node.js base image, installs prod deps, copies `src/`, exposes `3001`, runs `node src/index.js` under `dumb-init`).
- `server/docker-compose.yml`: A local, focused compose file that can run just the server (and an optional Caddy service) from within the `server/` folder. Useful for isolated server testing.
- `caddy/Caddyfile` (with `Caddyfile.example`): Reverse proxy configuration used by the root compose to expose the server on ports `80/443`.

## How They Fit Together

1. The root Compose declares a `server` service:
   - `build.context: ./server` and `dockerfile: Dockerfile` — it builds using `server/Dockerfile` with `server/` as the context.
   - `env_file: ./server/.env` — loads server environment variables (translator, auth settings, etc.).
   - `environment:` — sets or overrides variables (e.g., `NODE_ENV=production`, `PORT=3001`).
   - `volumes:` — binds local directories into the container for persistence:
     - `./server/logs:/app/logs`
     - `./server/config:/app/config`
     - `./server/models:/app/models`
     - `./server/.venv:/app/.venv` (optional local Python venv for the translator)
   - `expose: ["3001"]` — exposes port 3001 to other services on the compose network.
   - `healthcheck:` — hits `http://127.0.0.1:3001/health` inside the container.

2. The root Compose also declares `caddy`:
   - Depends on `server` health.
   - Publishes `80:80` and `443:443` to the host.
   - Mounts `./caddy/Caddyfile` and uses volumes for Caddy state (`caddy_data`, `caddy_config`).
   - Proxies traffic to `server:3001` (see `caddy/Caddyfile`).

3. The `server/Dockerfile` builds the image used by both compose files:
   - Installs production dependencies via `npm ci --omit=dev` in a separate stage.
   - Copies `src/` and `assets/` into the final runtime image.
   - Installs `curl`, `python3`, and `dumb-init` (healthcheck + translator runtime).
   - Writes version info to `/app/VERSION` (optional).
   - Starts the server with `CMD ["dumb-init", "node", "src/index.js"]`.

4. The `server/docker-compose.yml` is a smaller variant:
   - Builds from `server/` and publishes `3001:3001` directly to the host.
   - Uses named volumes for config/caddy by default instead of bind mounts.
   - Handy for running just the server during local development.

Important: Do not run both compose stacks at the same time on the same machine — both define a `caddy` that binds to ports `80/443`, which will conflict.

## Common Commands

Root stack (server + caddy):

- Build and start: `docker compose up -d --build`
- Follow logs: `docker compose logs -f server`
- Stop: `docker compose down`

Server only (from the `server/` folder):

- Build and start: `docker compose up -d --build`
- Reach server: `http://localhost:3001`
- Logs: `docker compose logs -f`
- Stop: `docker compose down`

Rebuild after code changes:

- Root: `docker compose build server && docker compose up -d`
- Server folder: `docker compose build && docker compose up -d`

## Environment & Configuration

- `server/.env` controls server features (auth, invites, translator, etc.). The root compose loads this via `env_file`.
- Translator settings (examples):
  - `TRANSLATOR_ENABLED=true`
  - `TRANSLATOR_PROVIDER=ct2`
  - `TRANSLATOR_PY=./src/translate/ct2_translator.py`
  - `CT2_MODEL_DE_EN=/app/models/ct2/de-en`
  - `CT2_MODEL_EN_DE=/app/models/ct2/en-de`
- Sensitive/semi-persistent data:
  - Tokens/config stored under `./server/config` (bind-mounted to `/app/config`).
  - Logs under `./server/logs` (bind-mounted to `/app/logs`).
  - Model files under `./server/models` (bind-mounted to `/app/models`).
  - Optional venv under `./server/.venv` (bind-mounted to `/app/.venv`).

## Healthcheck & Readiness

- The server exposes `/health` for health checks.
- In the root stack, `caddy` waits for `server` to be healthy (`depends_on: condition: service_healthy`).

## Version Labeling (Optional)

- The `server/docker-compose.yml` supports a build argument `APP_VERSION`.
- You can pass it in the root compose too, e.g.:

```yaml
services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
      args:
        APP_VERSION: ${APP_VERSION:-dev}
```

- Then build with: `APP_VERSION=1.0.3 docker compose build server`.

## Troubleshooting

- Port conflicts on `80/443`: Ensure only one compose stack with `caddy` runs at a time.
- Healthcheck failing: `docker compose logs -f server`, then curl `http://127.0.0.1:3001/health` inside the container or from caddy.
- Permission issues on bind mounts: Ensure the host directories exist and are writable (e.g., `./server/logs`, `./server/config`).
- Translator not responding: Check Python/venv setup under `./server/.venv` and that models are present under `./server/models`.

## Quick Start (Root)

1) Copy and adjust `server/env.example` to `server/.env`.
2) Ensure `./server/logs`, `./server/config`, and (if using translation) `./server/models` exist.
3) Start: `docker compose up -d --build`.
4) Access via your domain configured in `caddy/Caddyfile` (or add a temporary port mapping on the server service for local testing).

