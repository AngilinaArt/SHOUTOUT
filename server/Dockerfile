FROM node:20-bookworm-slim AS base

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json ./
# Produktionsabhängigkeiten installieren
RUN npm ci --omit=dev

# Build image with app source
FROM base AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
LABEL org.opencontainers.image.title="shoutout-server" \
      org.opencontainers.image.description="Shoutout WebSocket/HTTP server" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.vendor="Shoutout"
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node src ./src
COPY --chown=node:node assets ./assets
# Ordner für Logs/Config existieren lassen (werden als Volumes gemountet)
USER root
# Add curl (healthcheck), Python runtime, and dumb-init; then install HF deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl python3 python3-pip python3-venv dumb-init \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app/logs /app/config
RUN echo "$APP_VERSION" > /app/VERSION

# Run as root to ensure write permissions for mounted volumes (logs/config)
USER root

EXPOSE 3001

CMD ["dumb-init", "node", "src/index.js"]
