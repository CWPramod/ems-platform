# Multi-stage Dockerfile for EMS Probe Agent
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

# Build TypeScript
RUN npx nest build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install net-snmp native dependencies
RUN apk add --no-cache net-snmp-libs net-snmp

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy production node_modules from builder (already pruned)
COPY --from=builder /app/node_modules ./node_modules

# Copy package.json for runtime metadata
COPY package.json ./

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

ENV NODE_ENV=production
ENV PROBE_PORT=3006

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/main.js"]
