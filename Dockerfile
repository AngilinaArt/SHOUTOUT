# Stage 1: Build-Stage
FROM node:18-slim AS build

# Setze das Arbeitsverzeichnis im Container
WORKDIR /app/server

# Kopiere package.json und package-lock.json, um Abhängigkeiten zu installieren
# Dies nutzt Docker-Layer-Caching, um die Installation zu beschleunigen,
# wenn sich nur der Code ändert, nicht aber die Abhängigkeiten.
COPY server/package*.json ./

# Installiere die Abhängigkeiten
RUN npm install --production

# Kopiere den Rest des Server-Codes
COPY server/src ./src

# Stage 2: Produktions-Stage
FROM node:18-slim

# Setze das Arbeitsverzeichnis im Container
WORKDIR /app/server

# Kopiere nur die benötigten Dateien aus der Build-Stage
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/src ./src
COPY server/package*.json ./

# Exponiere den Port, auf dem der Server läuft (laut README.md ist es 3001)
EXPOSE 3001

# Definiere den Befehl zum Starten des Servers
CMD ["node", "src/index.js"]
