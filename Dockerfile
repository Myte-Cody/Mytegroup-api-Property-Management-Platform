# Production Dockerfile (multi-stage) for the NestJS API
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Install only production deps to keep runtime small
RUN npm install --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install full deps (incl. dev) to compile TypeScript
# Use npm install instead of npm ci here because some dev-only
# dependencies have lockfile metadata that npm ci treats as out of sync
# on Linux, even though production deps are consistent.
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Allow non-root node user to bind to privileged ports (e.g., 80)
# Also install curl for container health checks
RUN apk add --no-cache libcap curl \
  && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node
USER node
# Default app port inside container (aligns with ECS workflow expecting 80)
ENV APP_PORT=80
EXPOSE 80

# Copy runtime deps and built code
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/dist ./dist

# Start compiled server
CMD ["node", "dist/main.js"]
