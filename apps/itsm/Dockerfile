# Multi-stage Dockerfile for ITSM Module
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/itsm/package*.json ./apps/itsm/

# Install dependencies
RUN npm install --workspace=apps/itsm

# Copy source code
COPY apps/itsm ./apps/itsm

# Build the application
WORKDIR /app/apps/itsm
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./
COPY apps/itsm/package*.json ./apps/itsm/

# Install only production dependencies
RUN npm install --workspace=apps/itsm --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/apps/itsm/dist ./apps/itsm/dist

# Set ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Set working directory
WORKDIR /app/apps/itsm

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/ || exit 1

# Start the application
CMD ["node", "dist/main.js"]
