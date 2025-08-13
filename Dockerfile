# =========================
# Base deps (Root + Server)
# =========================
FROM node:22-alpine AS deps
WORKDIR /app

# Root-Manifeste zuerst (für shared deps / Workspaces)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Jetzt server-spezifische Dependencies separat installieren
WORKDIR /app/server
COPY server/package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# =========================
# Build-Stage
# =========================
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production

# Dependencies aus deps übernehmen (Root + Server)
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/server/node_modules /app/server/node_modules

# Restlichen Code – dank .dockerignore kommen client/bot nicht mit
COPY . .

# =========================
# Runtime-Stage (schlank)
# =========================
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps

# App aus Build-Stage übernehmen
COPY --from=build /app /app

# Laufverzeichnis ist dein Server-Ordner
WORKDIR /app/server

# Der Server soll im Container auf 0.0.0.0:3001 lauschen
EXPOSE 3001

# Nicht als root laufen – im node:22-alpine existiert der User bereits
USER node

# Startbefehl
CMD ["node", "src/index.js"]