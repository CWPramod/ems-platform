# EMS Platform — Deployment Guide

Production deployment guide for the EMS (Enterprise Management System) Platform.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Deployment Files](#deployment-files)
- [Quick Start](#quick-start)
- [Step-by-Step Deployment](#step-by-step-deployment)
  - [1. Build Images (Dev Server)](#1-build-images-dev-server)
  - [2. Export Images](#2-export-images)
  - [3. Transfer to Client Server](#3-transfer-to-client-server)
  - [4. Load Images](#4-load-images)
  - [5. Configure and Launch](#5-configure-and-launch)
  - [6. Validate Deployment](#6-validate-deployment)
- [Configuration Reference](#configuration-reference)
- [Services and Ports](#services-and-ports)
- [Common Operations](#common-operations)
- [SNMP Auto-Discovery](#snmp-auto-discovery)
- [Storage and Backups](#storage-and-backups)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                    ┌──────────────────────────────────────────────┐
                    │              Client Network                  │
                    └──────────────────┬───────────────────────────┘
                                       │ Port 80 (HTTP)
                    ┌──────────────────▼───────────────────────────┐
                    │  Frontend (Nginx + React SPA)                │
                    │  Reverse-proxies API calls to backend        │
                    └──────────────────┬───────────────────────────┘
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
    ┌──────────▼──────────┐ ┌──────────▼──────────┐ ┌─────────▼─────────┐
    │  NMS Module (:3001) │ │  API Core (:3100)   │ │ ITSM Module       │
    │  SNMP Discovery &   │ │  Assets, Alerts,    │ │ (:3005)           │
    │  Device Polling     │ │  Metrics, Auth      │ │ Ticketing &       │
    │                     │ │                     │ │ Incident Mgmt     │
    └─────────────────────┘ └──────────┬──────────┘ └───────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────┐
          │                            │                    │
    ┌─────▼──────────┐  ┌─────────────▼──────┐  ┌──────────▼────────┐
    │ ML Service     │  │ Probe Agent        │  │ PostgreSQL + Redis │
    │ (:8000)        │  │ (:3006)            │  │ (internal only)    │
    │ Anomaly        │  │ Remote SNMP        │  │ No exposed ports   │
    │ Detection      │  │ Polling            │  │                    │
    └────────────────┘  └────────────────────┘  └───────────────────┘
```

**8 containers** run on a single Docker host, communicating over an internal bridge network (`ems-internal`). Only the frontend is exposed externally.

---

## Prerequisites

**Client server requirements:**

| Requirement       | Minimum                       |
|-------------------|-------------------------------|
| OS                | Linux (Ubuntu 20.04+, RHEL 8+, Debian 11+) |
| Docker            | 20.10+ with Compose v2 plugin |
| RAM               | 4 GB                          |
| Disk              | 20 GB free                    |
| Network           | SNMP access (UDP/161) to target subnets |

Install Docker if needed:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

---

## Deployment Files

| File | Purpose |
|------|---------|
| `export-images.sh` | Packages all Docker images into a single `.tar.gz` for transfer |
| `load-images.sh` | Loads images from the `.tar.gz` on the client server |
| `configure-and-launch.sh` | Interactive setup: generates secrets, configures SNMP, launches services, triggers discovery |
| `validate-deployment.sh` | Post-deployment health check across all services, APIs, and storage |
| `import-inventory.sh` | Imports branch inventory (static IPs) as pre-registered assets |
| `trigger-discovery.sh` | Triggers IP-targeted SNMP discovery for inventory devices |
| `inventories/` | Branch inventory JSON files (e.g., `amc-branches.json`) |
| `../docker-compose.prod.yml` | Production Compose file (standalone, all 8 services) |
| `../.env.template` | Environment variable template with documentation |

---

## Quick Start

For experienced operators who want the shortest path:

```bash
# On dev server — build and export
docker compose -f docker-compose.prod.yml build
./deployment/export-images.sh

# Transfer to client
scp ems-platform-poc-1.0.tar.gz user@client:/opt/ems/
scp docker-compose.prod.yml .env.template user@client:/opt/ems/
scp deployment/{load-images.sh,configure-and-launch.sh,validate-deployment.sh,import-inventory.sh,trigger-discovery.sh} user@client:/opt/ems/
scp -r deployment/inventories user@client:/opt/ems/

# On client server
cd /opt/ems
./load-images.sh
./configure-and-launch.sh --community bankro --subnets "10.0.1.0/24" --server-ip 10.0.1.50
./validate-deployment.sh --server-ip 10.0.1.50
```

---

## Step-by-Step Deployment

### 1. Build Images (Dev Server)

Build all production images from source:

```bash
docker compose -f docker-compose.prod.yml build
```

This produces 6 application images tagged `canaris/ems-*:poc-1.0`:

| Image | Service | Base |
|-------|---------|------|
| `canaris/ems-api:poc-1.0` | REST API (NestJS) | node:20-alpine |
| `canaris/ems-nms:poc-1.0` | Network Management | node:20-alpine |
| `canaris/ems-itsm:poc-1.0` | IT Service Management | node:20-alpine |
| `canaris/ems-ml:poc-1.0` | ML/Anomaly Detection | python:3.11-slim |
| `canaris/ems-probe:poc-1.0` | Remote SNMP Probe | node:20-alpine |
| `canaris/ems-frontend:poc-1.0` | Web Dashboard (Nginx) | nginx:alpine |

Plus 2 infrastructure images pulled automatically: `postgres:15-alpine`, `redis:7-alpine`.

### 2. Export Images

Package all 8 images into a single compressed archive:

```bash
./deployment/export-images.sh
```

**Output:** `ems-platform-poc-1.0.tar.gz` (typically 800MB-1.2GB)

The script verifies all images exist before exporting. If any are missing, it will show which ones need to be built or pulled.

### 3. Transfer to Client Server

Transfer the archive and deployment files:

```bash
# Create deployment directory on client
ssh user@client "mkdir -p /opt/ems"

# Transfer files
scp ems-platform-poc-1.0.tar.gz user@client:/opt/ems/
scp docker-compose.prod.yml .env.template user@client:/opt/ems/
scp deployment/load-images.sh user@client:/opt/ems/
scp deployment/configure-and-launch.sh user@client:/opt/ems/
scp deployment/validate-deployment.sh user@client:/opt/ems/
```

For air-gapped environments, use a USB drive or other approved transfer method.

### 4. Load Images

On the client server:

```bash
cd /opt/ems
./load-images.sh
```

The script:
1. Decompresses and loads all images via `docker load`
2. Verifies each image is present with its size
3. Reports any missing images

**Custom tar path:**
```bash
./load-images.sh /path/to/ems-platform-poc-1.0.tar.gz
```

### 5. Configure and Launch

**Interactive mode** (recommended for first deployment):

```bash
./configure-and-launch.sh
```

The script will prompt for:
- **SNMP community string** — must match the target network devices
- **Discovery subnets** — CIDR ranges to scan (e.g., `10.0.1.0/24,192.168.1.0/24`)
- **Server IP** — for generating the dashboard URL (auto-detected if possible)

**Non-interactive mode** (for scripted deployments):

```bash
./configure-and-launch.sh \
  --community bankro \
  --subnets "10.0.1.0/24,192.168.1.0/24" \
  --server-ip 10.0.1.50
```

**What happens:**
1. Creates `.env` from template if it doesn't exist
2. Generates secure random passwords for database, JWT, and API keys
3. Writes SNMP and network configuration to `.env`
4. Starts all 8 services via Docker Compose
5. Waits up to 120 seconds for all health checks to pass
6. Automatically triggers SNMP subnet discovery
7. Prints a summary with the dashboard URL and credentials

### 6. Validate Deployment

After launch, run the validation script to confirm everything is working:

```bash
./validate-deployment.sh --server-ip 10.0.1.50
```

**Checks performed:**

| # | Check | What it validates |
|---|-------|-------------------|
| 1 | Container Health | All 8 containers running and healthy |
| 2 | Health Endpoints | Each service's HTTP health endpoint responds |
| 3 | Discovered Assets | Device inventory count and breakdown by type |
| 4 | Discovery Status | SNMP discovery job progress and devices found |
| 5 | Metric Data Flow | Polling data is being collected and stored |
| 6 | Active Alerts | Any open alerts with severity details |
| 7 | PostgreSQL Storage | DB size, largest tables, disk capacity, estimated days remaining |

If any check fails, the script prints targeted troubleshooting commands for that specific failure.

---

## Configuration Reference

All configuration is in `.env` (created from `.env.template`). Key variables:

### Required (auto-generated by configure-and-launch.sh)

| Variable | Description |
|----------|-------------|
| `DATABASE_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `LICENSE_SIGNING_SECRET` | License module signing key |
| `ITSM_MODULE_API_KEY` | Inter-service auth key for ITSM |

### SNMP & Discovery

| Variable | Default | Description |
|----------|---------|-------------|
| `SNMP_COMMUNITY` | `public` | SNMP v2c community string |
| `SNMP_MODE` | `production` | `production` for real devices, `simulation` for testing |
| `NMS_POLLING_ENABLED` | `true` | Enable/disable background SNMP polling |
| `DISCOVERY_SUBNETS` | *(empty)* | Comma-separated CIDRs for auto-discovery |
| `DISCOVERY_IPS` | *(empty)* | Comma-separated static IPs for targeted discovery |

### Operation

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_MODE` | `production` | `production` for real data, `demo` for simulated events |
| `WEB_PORT` | `80` | Frontend HTTP port exposed to clients |
| `DATABASE_NAME` | `ems_platform` | PostgreSQL database name |
| `DATABASE_USER` | `ems_admin` | PostgreSQL username |

---

## Services and Ports

| Service | Container | Internal Port | External Port | Health Endpoint |
|---------|-----------|--------------|---------------|-----------------|
| Frontend | ems-frontend | 80 | `WEB_PORT` (default: 80) | `GET /` |
| API | ems-api | 3100 | *(internal)* | `GET /` |
| NMS | ems-nms | 3001 | *(internal)* | `GET /health` |
| ITSM | ems-itsm | 3005 | *(internal)* | `GET /` |
| ML | ems-ml | 8000 | *(internal)* | `GET /api/v1/health` |
| Probe | ems-probe | 3006 | *(internal)* | `GET /health` |
| PostgreSQL | ems-postgres | 5432 | *(internal)* | `pg_isready` |
| Redis | ems-redis | 6379 | *(internal)* | `redis-cli ping` |

**Security note:** Only the frontend is exposed externally. All backend services, PostgreSQL, and Redis are accessible only within the `ems-internal` Docker network.

---

## Common Operations

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f nms

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### Restart services

```bash
# Single service
docker compose -f docker-compose.prod.yml restart nms

# All services
docker compose -f docker-compose.prod.yml restart
```

### Stop / start

```bash
# Stop (preserves data volumes)
docker compose -f docker-compose.prod.yml down

# Start
docker compose -f docker-compose.prod.yml up -d

# Stop and remove volumes (DESTROYS DATA)
docker compose -f docker-compose.prod.yml down -v
```

### Check service status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Access the dashboard

```
URL:      http://<server-ip>
Login:    admin
Password: admin123
```

> Change the default password after first login.

---

## SNMP Auto-Discovery

Discovery scans subnets for SNMP-enabled devices, classifies them, discovers interfaces, and starts polling automatically.

### Trigger discovery

**Via configure-and-launch.sh** (automatic if subnets are provided).

**Via API:**

```bash
curl -X POST http://localhost:3001/api/v1/nms/discover \
  -H 'Content-Type: application/json' \
  -d '{
    "subnets": ["10.0.1.0/24", "192.168.1.0/24"],
    "community": "bankro"
  }'
```

Response:
```json
{
  "jobId": "abc123...",
  "message": "Discovery started",
  "totalIPs": 508,
  "subnets": ["10.0.1.0/24", "192.168.1.0/24"]
}
```

### Check discovery progress

```bash
curl http://localhost:3001/api/v1/nms/discover/status?jobId=<jobId>
```

Response:
```json
{
  "jobId": "abc123...",
  "status": "completed",
  "progress": 100,
  "totalIPs": 254,
  "scannedIPs": 254,
  "devicesFound": 12,
  "devices": [
    {
      "ip": "10.0.1.1",
      "sysName": "GW-FIREWALL",
      "vendor": "Sophos",
      "deviceType": "firewall",
      "interfaceCount": 8,
      "assetId": "...",
      "skipped": false
    }
  ]
}
```

### Supported vendors

Devices are auto-classified by SNMP sysObjectID:

| Vendor | OID Prefix | Default Type |
|--------|-----------|--------------|
| Sophos | `1.3.6.1.4.1.2604` | firewall |
| Cisco | `1.3.6.1.4.1.9` | router |
| Juniper | `1.3.6.1.4.1.2636` | router |
| Fortinet | `1.3.6.1.4.1.12356` | firewall |
| Huawei | `1.3.6.1.4.1.2011` | switch |
| HP/Aruba | `1.3.6.1.4.1.11` | switch |

Unrecognized devices fall back to keyword detection from sysDescr.

### Discovery limits

- Maximum 1,024 IPs per subnet
- Maximum 5 subnets per request
- Subnet mask must be /16 to /30
- IPs are scanned in parallel batches of 20

---

## Inventory-Based Deployment (Static IPs)

For clients with known static IPs (e.g., branch WAN links) where CIDR subnet scanning is impractical or where SNMP community strings are not yet available.

### Workflow

**Phase 1 — Pre-register assets (no SNMP needed):**

```bash
# Import branch inventory — creates assets in "unknown" status
./import-inventory.sh --inventory inventories/amc-branches.json

# Or include during initial deployment
./configure-and-launch.sh \
  --inventory inventories/amc-branches.json \
  --server-ip 10.0.1.50
```

Assets appear in the dashboard immediately with status "unknown" and tag "pending-snmp". No SNMP traffic is generated.

**Phase 2 — Activate monitoring (when SNMP strings are available):**

```bash
# Trigger targeted discovery on the exact IPs from inventory
./trigger-discovery.sh \
  --inventory inventories/amc-branches.json \
  --community <community-string>
```

NMS probes only the listed IPs (not entire subnets), discovers device types/vendors/interfaces, updates the pre-registered assets, and starts polling.

### Inventory file format

Inventory files live in `deployment/inventories/` and follow this structure:

```json
{
  "customer": "Customer Name",
  "branches": [
    {
      "name": "Branch Name",
      "location": "City",
      "address": "Full address",
      "links": [
        { "ip": "10.0.1.1", "type": "primary" },
        { "ip": "10.0.1.2", "type": "secondary" }
      ]
    }
  ]
}
```

### IP-targeted discovery API

In addition to CIDR-based discovery, you can discover specific IPs directly:

```bash
curl -X POST http://localhost:3001/api/v1/nms/discover/ips \
  -H 'Content-Type: application/json' \
  -d '{
    "ips": ["10.0.1.1", "10.0.1.2", "192.168.1.1"],
    "community": "mystring"
  }'
```

This endpoint:
- Accepts up to 200 IPs per request
- Validates IP format (no CIDR notation)
- Updates pre-registered assets with `pending-snmp` tag instead of creating duplicates
- Returns the same `{ jobId, message, totalIPs }` response as subnet discovery
- Job status is checked via the same `GET /discover/status` endpoint

---

## Storage and Backups

### Database backup

```bash
# Backup
docker exec ems-postgres pg_dump -U ems_admin ems_platform | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20260226.sql.gz | docker exec -i ems-postgres psql -U ems_admin ems_platform
```

### Check storage

```bash
# Quick check via validate script
./validate-deployment.sh --server-ip localhost

# Manual check
docker exec ems-postgres psql -U ems_admin -d ems_platform \
  -c "SELECT pg_size_pretty(pg_database_size('ems_platform'));"
```

### Docker volume location

Data persists in Docker named volumes:
- `postgres_data` — PostgreSQL database files
- `redis_data` — Redis AOF persistence

List volumes:
```bash
docker volume ls | grep ems
```

---

## Troubleshooting

### Service won't start

```bash
# Check logs for the failing service
docker compose -f docker-compose.prod.yml logs --tail=100 <service>

# Verify dependencies are healthy
docker compose -f docker-compose.prod.yml ps

# Restart the service
docker compose -f docker-compose.prod.yml restart <service>
```

### Database connection errors

```bash
# Verify PostgreSQL is healthy
docker exec ems-postgres pg_isready -U ems_admin -d ems_platform

# Check credentials match .env
grep DATABASE_PASSWORD .env

# Check connection count
docker exec ems-postgres psql -U ems_admin -d ems_platform \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

### No devices discovered

1. Verify SNMP community string matches devices:
   ```bash
   # Test from the server
   docker exec ems-nms snmpget -v2c -c <community> <device-ip> 1.3.6.1.2.1.1.1.0
   ```
2. Check firewall rules allow UDP/161 from the Docker host to the target subnet.
3. Verify subnets in `.env`:
   ```bash
   grep DISCOVERY_SUBNETS .env
   ```
4. Re-trigger discovery:
   ```bash
   curl -X POST http://localhost:3001/api/v1/nms/discover \
     -H 'Content-Type: application/json' \
     -d '{"subnets":["10.0.1.0/24"],"community":"public"}'
   ```

### Health check timeouts

Services may take up to 60 seconds to start, especially on first boot when database migrations run. If health checks fail:

```bash
# Wait and re-check
sleep 30
./validate-deployment.sh

# If API is stuck, check database connectivity
docker compose -f docker-compose.prod.yml logs api | grep -i "error\|database\|connect"
```

### Out of disk space

```bash
# Check disk usage
df -h /

# Prune unused Docker resources
docker system prune -f

# Rotate logs manually
docker compose -f docker-compose.prod.yml logs --tail=0

# Check PostgreSQL size
docker exec ems-postgres psql -U ems_admin -d ems_platform \
  -c "SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename))
      FROM pg_tables WHERE schemaname='public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC LIMIT 10;"
```

### Full redeploy

If all else fails, redeploy without losing data:

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
./validate-deployment.sh
```

To completely reset (destroys all data):

```bash
docker compose -f docker-compose.prod.yml down -v
./configure-and-launch.sh
```
