# =========================
# Base deps (nutzt Root-Lockfile)
# =========================
FROM node:22-alpine AS deps
WORKDIR /app

# Nur die Manifeste – maximiert Layer-Caching
COPY package*.json ./

# Bevorzugt reproduzierbar mit npm ci; Fallback auf npm install, falls kein Lockfile
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# =========================
# Build-Stage (falls du später mal Build-Schritte brauchst)
# =========================
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production

# Dependencies aus deps übernehmen
COPY --from=deps /app/node_modules /app/node_modules

# Restlichen Code – dank .dockerignore kommen client/bot nicht mit
COPY . .

# Falls du irgendwann einen Build brauchst (z. B. TypeScript o. ä.):
# RUN npm run build

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

USER node

# Startbefehl
CMD ["node", "src/index.js"]