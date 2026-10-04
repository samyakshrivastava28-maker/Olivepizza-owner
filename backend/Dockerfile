# ==============================================================================
# OLIVE PIZZA STANDALONE BACKEND — PRODUCTION DOCKERFILE
# Multi-stage, zero-secret, non-root Node.js LTS Alpine container
# ==============================================================================

# ── Stage 1: Build & Compilation ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies required for native modules
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json tsconfig*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy full application source code
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# ── Stage 2: Minimal Production Runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure security updates and required runtime libraries
RUN apk update && apk upgrade && apk add --no-cache curl tzdata && rm -rf /var/cache/apk/*

# Enforce production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests for production-only dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create runtime directories if needed and set non-root ownership
RUN chown -R node:node /app

# Security Invariant: Never run container as root
USER node

# Expose internal API port (traffic forwarded via NGINX reverse proxy)
EXPOSE 5000

# Container healthcheck using liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/health/live || exit 1

# Launch compiled backend server
CMD ["node", "dist/server.js"]
