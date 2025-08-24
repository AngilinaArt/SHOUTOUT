FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./
# Produktionsabhängigkeiten installieren
RUN npm ci --omit=dev

# Build image with app source
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
USER node
WORKDIR /app
COPY --from=deps /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node src ./src
COPY --chown=node:node assets ./assets
# Ordner für Logs/Config existieren lassen (werden als Volumes gemountet)
USER root
RUN apk add --no-cache curl
RUN mkdir -p /app/logs /app/config

EXPOSE 3001

CMD ["dumb-init", "node", "src/index.js"]
