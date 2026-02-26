# Multi-stage Dockerfile for ML Service
# Stage 1: Build stage — install Python dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build-time system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Production — minimal runtime image
FROM python:3.11-slim

WORKDIR /app

# Install runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -s /bin/sh appuser

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy only the application code (not tests, docs, configs)
COPY app ./app

# Create directories for runtime data
RUN mkdir -p app/ml/models app/data logs && \
    chown -R appuser:appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/health')"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
