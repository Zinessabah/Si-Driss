# Multi-stage production Dockerfile for Si Driss - Universal Platform
# Compatible with Docker Desktop, Linux VPS, Google Cloud Run, Render, Railway, AWS ECS

# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code and build Vite bundle
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit && \
    npm install -g tsx && \
    npm cache clean --force

# Copy compiled frontend and backend code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/docs ./docs

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ai-status || exit 1

# Start universal server
CMD ["tsx", "server.ts"]
