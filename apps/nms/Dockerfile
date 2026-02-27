# Multi-stage Dockerfile for NMS Module
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and NMS package files
COPY package*.json ./
COPY apps/nms/package*.json ./apps/nms/
COPY apps/nms/tsconfig*.json ./apps/nms/
COPY apps/nms/nest-cli.json ./apps/nms/

# Install dependencies
WORKDIR /app/apps/nms
RUN npm ci

# Copy NMS source code only
COPY apps/nms/src ./src

# Build TypeScript
RUN npx nest build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Stage 2: Production — minimal image
FROM node:20-alpine AS production

WORKDIR /app

# Install net-snmp native dependencies
RUN apk add --no-cache net-snmp-libs net-snmp

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy production node_modules from builder (already pruned)
COPY --from=builder /app/apps/nms/node_modules ./node_modules

# Copy package.json for runtime metadata
COPY apps/nms/package.json ./

# Copy built files from builder (no source code)
COPY --from=builder /app/apps/nms/dist ./dist

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

ENV NODE_ENV=production
ENV NMS_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/main.js"]
