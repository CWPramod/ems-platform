# Multi-stage Dockerfile for NestJS API
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --workspace=apps/api

# Copy source code
COPY apps/api ./apps/api

# Build the application
WORKDIR /app/apps/api
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install only production dependencies
RUN npm ci --workspace=apps/api --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Set working directory
WORKDIR /app/apps/api

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/ || exit 1

# Start the application
CMD ["node", "dist/main.js"]
