FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only server dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy server sources
COPY . ./

# Ensure logs dir exists and is writable
RUN mkdir -p logs && chown -R node:node logs

EXPOSE 3001
USER node
CMD ["node", "src/index.js"]

