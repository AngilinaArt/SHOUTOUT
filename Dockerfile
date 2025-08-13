# ---- build ----
  FROM node:22-alpine AS build
  WORKDIR /app/server
  COPY server/package*.json ./
  RUN npm ci --omit=dev
  COPY server/ ./
  
  # ---- runtime ----
  FROM node:22-alpine
  WORKDIR /app/server
  ENV NODE_ENV=production
  COPY --from=build /app/server /app/server
  EXPOSE 3001
  CMD ["node", "src/index.js"]