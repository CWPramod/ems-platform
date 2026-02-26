# NMS Module - Dockerfile (monorepo-compatible)

FROM node:18-alpine AS builder

WORKDIR /app

# Copy root and NMS package files
COPY package*.json ./
COPY apps/nms/package*.json ./apps/nms/
COPY apps/nms/tsconfig*.json ./apps/nms/
COPY apps/nms/nest-cli.json ./apps/nms/

# Install dependencies
WORKDIR /app/apps/nms
RUN npm ci

# Copy NMS source code
COPY apps/nms/src ./src

# Build TypeScript
RUN npx nest build

# Production image
FROM node:18-alpine

WORKDIR /app

# Install net-snmp native dependencies
RUN apk add --no-cache \
    net-snmp-libs \
    net-snmp

# Copy package files for production install
COPY apps/nms/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/apps/nms/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV NMS_PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/main.js"]
