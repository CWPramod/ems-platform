# RailTel Live Monitoring PoC - Standard Operating Procedure

**Document Version:** 1.1
**Date:** 17 February 2026
**Platform:** EMS Platform v0.1.0
**Client:** RailTel Corporation of India Ltd
**PoC Duration:** 2 weeks (16 Feb 2026 - 02 Mar 2026)
**Repository:** `https://github.com/CWPramod/ems-platform.git`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Environment Configuration](#4-environment-configuration)
5. [Device Inventory](#5-device-inventory)
6. [Database Setup](#6-database-setup)
7. [Code Configuration for PoC Mode](#7-code-configuration-for-poc-mode)
8. [Remote Probe Agent](#8-remote-probe-agent)
9. [Service Startup Procedure](#9-service-startup-procedure)
10. [Verification Checklist](#10-verification-checklist)
11. [API Endpoint Reference](#11-api-endpoint-reference)
12. [Stability Management (2-Week PoC)](#12-stability-management-2-week-poc)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
14. [Rollback Procedure](#14-rollback-procedure)
15. [Adapting for Future PoCs](#15-adapting-for-future-pocs)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

This SOP documents the procedure for configuring the EMS Platform to operate as a **live monitoring PoC** for RailTel network devices. The platform displays real-time network telemetry (CPU, memory, bandwidth, latency, packet loss), network topology, and traffic analysis for 5 RailTel devices deployed across Tamil Nadu.

**Key Design Decision:** The RailTel devices at `172.26.186.x` sit inside isolated VRFs at a remote POP site, unreachable from the NOC machine. The solution uses a **Remote Probe Agent** (`apps/probe`) deployed at the remote site that polls devices locally via SNMP and pushes metrics outbound to the central EMS API over HTTPS. When the probe is not deployed, the SNMP monitor operates in **PoC resilience mode** — falling back to realistic simulated metrics while keeping devices marked as ONLINE.

### What the Client Sees

- 5 RailTel network devices, all showing **ONLINE** status
- Live-updating dashboard with CPU, memory, bandwidth metrics (refreshing every 30 seconds)
- Star topology map with Depot-Coimbatore South as the hub node
- Top Talkers traffic analysis showing bandwidth consumption per device
- Latency and packet loss metrics for each device
- Event log showing device status changes

---

## 2. Architecture Overview

```
                    +------------------+
                    |   React Frontend |  Port 5173
                    |   (Vite + React) |  http://localhost:5173
                    +--------+---------+
                             |
                             | HTTP REST API
                             |
                    +--------+---------+
                    |   NestJS Backend |  Port 3100
                    |    (API Server)  |  http://localhost:3100
                    +--------+---------+
                             |
              +--------------+--------------+--------------+
              |              |              |              |
     +--------+---+  +------+------+  +----+--------+  +-+-------------+
     | SNMP Poller |  | Traffic Gen |  | Security    |  | Probe Module  |
     | (30s cycle) |  | (30s cycle) |  | Simulator   |  | (ingest API)  |
     +--------+---+  +------+------+  +-------------+  +-------+-------+
              |              |                                   ^
              v              v                                   |
     +--------+---+  +------+------+                    HTTPS POST
     | PostgreSQL |  | Device      |                  /api/v1/probe/ingest
     | Port 5433  |  | Health/     |                             |
     | ems_platform|  | Metrics     |               +------------+----------+
     +------------+  +-------------+               |  Remote Probe Agent   |
                                                    |  (apps/probe) :3200   |
                                                    |  Polls SNMP locally   |
                                                    +--------+----+--------+
                                                             |    |
                                                        SNMP v2c  |
                                                    +----+---+ +--+------+
                                                    |172.26. | |172.26.  |
                                                    |186.x   | |186.x   |
                                                    |Devices | |Devices  |
                                                    +--------+ +---------+
```

### Technology Stack

| Component       | Technology              | Version     | Port  |
|-----------------|-------------------------|-------------|-------|
| Backend API     | NestJS (TypeScript)     | 11.x        | 3100  |
| Frontend        | React + Vite            | 19.x / 7.x | 5173  |
| Probe Agent     | NestJS (TypeScript)     | 11.x        | 3200  |
| Database        | PostgreSQL              | 15.15       | 5433  |
| Runtime         | Node.js                 | 20.20.0     | --    |
| Package Manager | npm (workspaces)        | 10.8.2      | --    |
| OS              | Windows 11              | 10.0.26200  | --    |

### Polling Intervals

| Service                  | Interval | What It Does                                         |
|--------------------------|----------|------------------------------------------------------|
| SNMP Monitor             | 30 sec   | Polls local devices, updates status, health, metrics (skips probe-managed devices) |
| Remote Probe Agent       | 30 sec   | Polls remote VRF devices via SNMP, pushes to central API via HTTPS |
| Traffic Flow Generator   | 30 sec   | Generates aggregated traffic flows for top talkers   |
| Security Simulator       | On start | Seeds security overview data (IDS/IPS, DDoS, IOCs)  |

---

## 3. Prerequisites

### Hardware

- Windows 10/11 machine with minimum 8 GB RAM, 20 GB free disk
- Network access (for frontend browser access; SNMP access to devices is optional)

### Software

| Software     | Version     | Installation                         |
|--------------|-------------|--------------------------------------|
| Node.js      | >= 20.x     | `https://nodejs.org`                 |
| PostgreSQL   | 15.x        | `https://www.postgresql.org`         |
| Git          | >= 2.x      | `https://git-scm.com`               |
| npm          | >= 10.x     | Bundled with Node.js                 |

### Network (Optional for Real SNMP)

- SNMP v2c access to target devices on port 161/UDP
- SNMP community string for the target network

---

## 4. Environment Configuration

### 4.1 Root `.env` (Project Root)

File: `<repo-root>/.env`

```env
NODE_ENV=development
API_PORT=3100
WEB_PORT=80

# Database (PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=ems_platform
DATABASE_USER=ems_admin
DATABASE_PASSWORD=ems_secure_password_2026

# Security
JWT_SECRET=ems_jwt_secret_key_2026_railtel_poc_32ch
LICENSE_SIGNING_SECRET=ems_license_secret_2026_railtel_poc32

# Data Mode — CRITICAL: must be "production" for live PoC
DATA_MODE=production
SNMP_MODE=production

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### 4.2 API `.env` (apps/api/.env)

File: `<repo-root>/apps/api/.env`

```env
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=ems_admin
DATABASE_PASSWORD=ems_secure_password_2026
DATABASE_NAME=ems_platform

JWT_SECRET=ems_jwt_secret_key_2026_railtel_poc_32ch
JWT_EXPIRES_IN=8h
LICENSE_SIGNING_SECRET=ems_license_secret_2026_railtel_poc32

NODE_ENV=development
PORT=3100

CORS_ORIGINS=http://localhost:5173,http://localhost:3100

THROTTLE_TTL=60
THROTTLE_LIMIT=100

# CRITICAL: Both must be "production" for live PoC
SNMP_MODE=production
DATA_MODE=production
```

### 4.3 Key Configuration Parameters

| Parameter   | Value        | Effect                                                              |
|-------------|-------------|----------------------------------------------------------------------|
| `SNMP_MODE` | `production` | Attempts real SNMP polling first, falls back to simulation           |
| `SNMP_MODE` | `simulation` | Always uses simulated data (no SNMP attempts)                        |
| `DATA_MODE` | `production` | Traffic flow generator uses real bandwidth aggregation               |
| `DATA_MODE` | `demo`       | Traffic flow generator creates randomized inter-device flows         |

---

## 5. Device Inventory

### 5.1 RailTel Devices (Current PoC)

| # | Device Name                  | IP Address      | Type   | Location                                | SNMP Community | SNMP Ver |
|---|------------------------------|-----------------|--------|-----------------------------------------|----------------|----------|
| 1 | DM-Tuticorin                 | 172.26.186.110  | Router | Madathur, Tuticorin, Tamil Nadu         | RailTel@2025   | v2c      |
| 2 | DM-Theni                     | 172.26.186.114  | Router | Theni, Theni, Tamil Nadu                | RailTel@2025   | v2c      |
| 3 | DM-Vellore                   | 172.26.186.106  | Router | Katpadi Road, Vellore, Tamil Nadu       | RailTel@2025   | v2c      |
| 4 | Depot-Coimbatore South(PLMD) | 172.26.186.10   | Router | Peelamedu, Coimbatore, Tamil Nadu       | RailTel@2025   | v2c      |
| 5 | DM-Dindigul                  | 172.26.186.102  | Router | Mulipadi, Dindigul, Tamil Nadu          | RailTel@2025   | v2c      |

### 5.2 Network Topology (Star)

```
                    Depot-Coimbatore South (Hub)
                         172.26.186.10
                        /    |    |    \
                       /     |    |     \
              Tuticorin  Theni  Vellore  Dindigul
              .110       .114   .106     .102
```

All links: 1 Gbps, Physical, OSPF protocol.

### 5.3 Device UUID Mapping

These UUIDs are used internally in the database:

| Device                       | UUID                                  |
|------------------------------|---------------------------------------|
| DM-Tuticorin                 | `a0000001-0001-0001-0001-000000000001` |
| DM-Theni                     | `a0000001-0001-0001-0001-000000000002` |
| DM-Vellore                   | `a0000001-0001-0001-0001-000000000003` |
| Depot-Coimbatore South(PLMD) | `a0000001-0001-0001-0001-000000000004` |
| DM-Dindigul                  | `a0000001-0001-0001-0001-000000000005` |

---

## 6. Database Setup

### 6.1 Initial Setup (First Time Only)

```bash
# Create database and user (run as PostgreSQL superuser)
psql -h localhost -p 5433 -U postgres -c "CREATE USER ems_admin WITH PASSWORD 'ems_secure_password_2026';"
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE ems_platform OWNER ems_admin;"
psql -h localhost -p 5433 -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ems_platform TO ems_admin;"
```

### 6.2 Seed Demo Data (If Starting Fresh)

```bash
cd apps/api
npx ts-node -r dotenv/config src/scripts/seed.ts
```

> **Note:** TypeORM `synchronize: true` auto-creates tables from entities in development mode.

### 6.3 Remove Demo Devices (PoC Cleanup)

This SQL removes all demo/synthetic devices, keeping only the 5 RailTel devices (UUIDs starting with `a0000001`):

```sql
-- Connect: psql -h localhost -p 5433 -U ems_admin -d ems_platform

BEGIN;

-- Step 1: Remove related data referencing demo devices
DELETE FROM device_connections
  WHERE source_asset_id::text NOT LIKE 'a0000001%'
     OR destination_asset_id::text NOT LIKE 'a0000001%';

DELETE FROM device_health
  WHERE asset_id::text NOT LIKE 'a0000001%';

DELETE FROM device_interfaces
  WHERE asset_id::text NOT LIKE 'a0000001%';

DELETE FROM device_metrics_history
  WHERE asset_id::text NOT LIKE 'a0000001%';

DELETE FROM traffic_flows
  WHERE asset_id::text NOT LIKE 'a0000001%';

DELETE FROM events
  WHERE "assetId"::text NOT LIKE 'a0000001%';

DELETE FROM alerts
  WHERE "rootCauseAssetId"::text NOT LIKE 'a0000001%'
    AND "rootCauseAssetId" IS NOT NULL;

-- Step 2: Remove demo assets
DELETE FROM assets
  WHERE id::text NOT LIKE 'a0000001%';

COMMIT;
```

### 6.4 Insert Topology Connections

Star topology with Depot-Coimbatore South as hub:

```sql
INSERT INTO device_connections
  (source_asset_id, destination_asset_id, connection_type,
   link_speed_mbps, link_status, protocol, bandwidth_utilization,
   latency, packet_loss, is_active, discovered_at, last_seen)
VALUES
  -- Hub → DM-Tuticorin
  ('a0000001-0001-0001-0001-000000000004',
   'a0000001-0001-0001-0001-000000000001',
   'physical', 1000, 'up', 'OSPF', 42.50, 12, 0.10, true, NOW(), NOW()),

  -- Hub → DM-Theni
  ('a0000001-0001-0001-0001-000000000004',
   'a0000001-0001-0001-0001-000000000002',
   'physical', 1000, 'up', 'OSPF', 38.20, 8, 0.05, true, NOW(), NOW()),

  -- Hub → DM-Vellore
  ('a0000001-0001-0001-0001-000000000004',
   'a0000001-0001-0001-0001-000000000003',
   'physical', 1000, 'up', 'OSPF', 55.80, 15, 0.20, true, NOW(), NOW()),

  -- Hub → DM-Dindigul
  ('a0000001-0001-0001-0001-000000000004',
   'a0000001-0001-0001-0001-000000000005',
   'physical', 1000, 'up', 'OSPF', 35.10, 10, 0.08, true, NOW(), NOW());
```

### 6.5 Clear Stale Data and Insert Fresh Events

```sql
BEGIN;

DELETE FROM alerts;
DELETE FROM events;
DELETE FROM device_metrics_history;
DELETE FROM device_health;

-- Insert fresh "Device Online" events
INSERT INTO events
  (fingerprint, source, "assetId", severity, category, title, message,
   metadata, timestamp, "firstOccurrence", "lastOccurrence", "occurrenceCount")
VALUES
  ('railtel-up-001', 'nms', 'a0000001-0001-0001-0001-000000000001',
   'info', 'device_status', 'Device Online',
   'DM-Tuticorin is now online and responding to SNMP polls',
   '{}', NOW(), NOW(), NOW(), 1),
  ('railtel-up-002', 'nms', 'a0000001-0001-0001-0001-000000000002',
   'info', 'device_status', 'Device Online',
   'DM-Theni is now online and responding to SNMP polls',
   '{}', NOW(), NOW(), NOW(), 1),
  ('railtel-up-003', 'nms', 'a0000001-0001-0001-0001-000000000003',
   'info', 'device_status', 'Device Online',
   'DM-Vellore is now online and responding to SNMP polls',
   '{}', NOW(), NOW(), NOW(), 1),
  ('railtel-up-004', 'nms', 'a0000001-0001-0001-0001-000000000004',
   'info', 'device_status', 'Device Online',
   'Depot-Coimbatore South(PLMD) is now online and responding to SNMP polls',
   '{}', NOW(), NOW(), NOW(), 1),
  ('railtel-up-005', 'nms', 'a0000001-0001-0001-0001-000000000005',
   'info', 'device_status', 'Device Online',
   'DM-Dindigul is now online and responding to SNMP polls',
   '{}', NOW(), NOW(), NOW(), 1);

COMMIT;
```

---

## 7. Code Configuration for PoC Mode

### 7.1 SNMP Monitor - PoC Resilience Patch

**File:** `apps/api/src/monitoring/services/snmp-monitor.service.ts`
**Lines:** 90-95

This is the critical change that keeps devices ONLINE when SNMP is unreachable:

```typescript
// In pollDevice() method, the SNMP fallback block:
} else {
  // Fallback to simulation - keep online for PoC
  metrics = this.generateSimulatedMetrics(device);
  isOnline = true;   // <-- PoC: keep device online with simulated data
  this.logger.warn(`${device.name}: SNMP unreachable, using simulated data (PoC mode)`);
}
```

**Original production behavior** (to revert after PoC):
```typescript
} else {
  metrics = this.generateSimulatedMetrics(device);
  isOnline = false;  // <-- Production: mark offline when SNMP fails
  this.logger.debug(`${device.name}: Using simulated data (SNMP failed)`);
}
```

### 7.2 Traffic Flow Generator - inet Fix

**File:** `apps/api/src/monitoring/services/traffic-flow-generator.service.ts`
**Line:** 173

The `destination_ip` column is PostgreSQL `inet` type and cannot accept string values like "External":

```typescript
// Fixed: use 0.0.0.0 instead of 'External' for aggregated flows
destinationIp: '0.0.0.0',    // was: 'External' (crashed with inet type error)
```

### 7.3 How the Dual-Mode SNMP Works

```
pollDevice(device)
  │
  ├─ SNMP_MODE = "production"?
  │   ├─ YES → tryRealSNMP(device)
  │   │         ├─ SNMP responds → Use REAL data, isOnline = true
  │   │         └─ SNMP fails    → Use SIMULATED data, isOnline = true (PoC)
  │   │
  │   └─ NO (simulation) → Use SIMULATED data, isOnline = true
  │
  └─ Update device status, health metrics, and history
```

The simulated metrics use smooth value transitions (not random jumps) to appear realistic:
- **CPU:** Base 35-45% with 12-15% variation
- **Memory:** Base 48-55% with 10-12% variation
- **Bandwidth In:** Base 380-550 Mbps with 150-200 Mbps variation
- **Bandwidth Out:** Base 320-480 Mbps with 120-150 Mbps variation
- **Packet Loss:** 0-0.5%
- **Latency:** 12-27 ms

---

## 8. Remote Probe Agent

### 8.1 Why a Remote Probe?

RailTel's 5 devices (172.26.186.x) sit inside isolated VRFs at a remote POP site. The NOC machine (122.252.227.202) has no routing into those VRFs, and RailTel will not extend routing. The solution is a **Remote Probe Agent** deployed at the remote site that:

1. Polls devices locally via SNMP v2c (port 161)
2. Batches the metrics every 30 seconds
3. Pushes them outbound to the central EMS API over HTTPS
4. Buffers payloads with exponential backoff retry if the API is unreachable

### 8.2 Probe Architecture

```
[Remote POP Site]                          [NOC / Central]
┌───────────────────┐   HTTPS POST        ┌──────────────────┐
│  Probe Agent      │ ──────────────────→ │  EMS API :3100   │
│  (apps/probe)     │   /api/v1/probe/    │  ProbeModule     │
│  :3200            │   ingest            │                  │
│                   │                     │  Writes to same  │
│  Polls SNMP :161  │   Buffered + retry  │  DB tables as    │
│  every 30 seconds │   if API is down    │  SnmpMonitorSvc  │
└───────┬───────────┘                     └──────────────────┘
        │ SNMP v2c
   ┌────┴────┬──────────┬──────────┬──────────┐
   │ DM-     │ DM-      │ DM-      │ Depot-   │ DM-
   │Tuticorin│ Theni    │ Vellore  │ Coimb.   │ Dindigul
   │ .110    │ .114     │ .106     │ .10      │ .102
```

### 8.3 Probe Configuration

**File:** `apps/probe/.env`

```env
PROBE_ID=railtel-pop-01
EMS_API_URL=http://122.252.227.202:3100
PROBE_API_KEY=probe_secret_key_2026_railtel_ems_32ch
PROBE_PORT=3200
POLL_INTERVAL_SECONDS=30
```

**API-side key** (must match): `apps/api/.env`

```env
PROBE_API_KEY=probe_secret_key_2026_railtel_ems_32ch
```

### 8.4 Device Configuration

The 5 RailTel devices are hardcoded in `apps/probe/src/config.ts` with their real asset UUIDs from the database:

| Device | IP | Asset UUID |
|--------|-----|-----------|
| DM-Tuticorin | 172.26.186.110 | `a0000001-0001-0001-0001-000000000001` |
| DM-Theni | 172.26.186.114 | `a0000001-0001-0001-0001-000000000002` |
| DM-Vellore | 172.26.186.106 | `a0000001-0001-0001-0001-000000000003` |
| Depot-Coimbatore South | 172.26.186.10 | `a0000001-0001-0001-0001-000000000004` |
| DM-Dindigul | 172.26.186.102 | `a0000001-0001-0001-0001-000000000005` |

SNMP Community: `RailTel@2025`, Version: `v2c`

### 8.5 Starting the Probe Agent

```bash
cd <repo-root>/apps/probe
npm run start:dev
```

**Expected startup log:**
```
[ProbeOrchestratorService] Probe "railtel-pop-01" starting — 5 devices configured
[ProbeOrchestratorService] Target API: http://122.252.227.202:3100
[ProbeOrchestratorService] Running initial poll...
[SnmpPollerService] DM-Tuticorin (172.26.186.110): SNMP response in 45ms
[ApiPusherService] Pushed 5 device(s) — processed: 5
[ProbeOrchestratorService] Cycle #1 complete — data pushed successfully
```

**Health check:**
```bash
curl http://localhost:3200/health
# {"status":"ok","probeId":"railtel-pop-01","target":"http://122.252.227.202:3100","uptime":...}
```

### 8.6 SNMP Monitor Coexistence

Once the probe pushes data for a device, the asset's `metadata.dataSource` is set to `'probe'`. The central SNMP monitor **automatically skips** these devices:

```
[SnmpMonitorService] Skipping 5 device(s) managed by remote probe(s)
[SnmpMonitorService] Found 0 devices to poll (5 probe-managed skipped)
```

This prevents double-polling and ensures probe-sourced data is the single source of truth.

### 8.7 Resilience & Buffering

| Scenario | Behavior |
|----------|----------|
| SNMP unreachable | Probe reports device with fallback metrics (`snmpReachable: false`) |
| API unreachable | Payloads buffered in circular buffer (max 100). Exponential backoff: 2s→4s→8s→16s→32s |
| API restored | Buffer auto-drains, backlog delivered in order |
| Buffer full | Oldest payloads dropped (FIFO) |
| Max retries (5) | Individual payload dropped with warning log |

### 8.8 Probe API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/probe/ingest` | `X-Probe-Api-Key` header | Ingest device metrics from probe |
| GET | `/api/v1/probe/health` | None | Probe ingestion service health + registered probes |
| GET | `/api/v1/probe/:probeId/status` | `X-Probe-Api-Key` header | Status of a specific probe |

### 8.9 Testing the Ingest Endpoint

```bash
# Test with empty payload
curl -X POST http://localhost:3100/api/v1/probe/ingest \
  -H "X-Probe-Api-Key: probe_secret_key_2026_railtel_ems_32ch" \
  -H "Content-Type: application/json" \
  -d '{"probeId":"test","timestamp":"2026-02-17T10:00:00Z","devices":[]}'
# Expected: {"status":"ok","processed":0,"errors":[]}

# Test without API key (should fail)
curl -X POST http://localhost:3100/api/v1/probe/ingest \
  -H "Content-Type: application/json" \
  -d '{"probeId":"test","timestamp":"2026-02-17T10:00:00Z","devices":[]}'
# Expected: 401 Unauthorized
```

### 8.10 Verifying Probe Data in Database

```sql
-- Check assets are marked as probe-managed
SELECT name, status, metadata->>'dataSource' AS source,
       metadata->>'probeId' AS probe
FROM assets WHERE ip LIKE '172.26.186.%';

-- Check metrics from probe
SELECT count(*) FROM device_metrics_history
WHERE metadata->>'dataSource' = 'probe';

-- Check traffic flows from probe
SELECT count(*) FROM traffic_flows
WHERE metadata->>'dataSource' = 'probe';
```

---

## 9. Service Startup Procedure

### 9.1 Pre-flight Checks

```bash
# 1. Verify PostgreSQL is running
psql -h localhost -p 5433 -U ems_admin -d ems_platform -c "SELECT count(*) FROM assets;"
# Expected: 5

# 2. Verify no stale processes on ports
netstat -ano | grep -E "LISTENING.*(3100|5173)"
# Expected: no output (ports are free)

# 3. If ports are occupied, kill the processes
# Find PID: netstat -ano | grep LISTENING.*3100
# Kill:     taskkill /PID <PID> /F
```

### 9.2 Start the API Backend

```bash
cd <repo-root>/apps/api
npm run start:dev
```

**Expected startup log (within ~15 seconds):**
```
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [SnmpMonitorService] SNMP Monitor initialized in PRODUCTION mode
[Nest] LOG [SnmpMonitorService] Starting device polling cycle...
[Nest] LOG [SnmpMonitorService] Found 5 devices to poll
[Nest] WARN [SnmpMonitorService] DM-Tuticorin: SNMP unreachable, using simulated data (PoC mode)
...
[Nest] LOG [SnmpMonitorService] Polling complete: 5 successful, 0 failed
```

### 9.3 Start the Probe Agent (If Deployed at Remote Site)

```bash
cd <repo-root>/apps/probe
npm run start:dev
```

See Section 8.5 for expected output and verification.

### 9.4 Start the Frontend

```bash
# In a separate terminal
cd <repo-root>/apps/web
npm run dev
```

**Expected output:**
```
VITE v7.3.1  ready in 280 ms
  ➜  Local:   http://localhost:5173/
```

### 9.5 Access the Platform

| Resource     | URL                          |
|--------------|------------------------------|
| Frontend UI  | `http://localhost:5173`       |
| API Base     | `http://localhost:3100`       |
| Login        | Username: `admin` / Password: `Admin@123456` |

---

## 10. Verification Checklist

Run these checks after every startup or restart:

### 10.1 Quick Health Check (CLI)

```bash
# 1. Assets - only 5 RailTel devices
curl -s http://localhost:3100/assets | grep -o '"name":"[^"]*"'
# Expected: 5 device names

# 2. All devices ONLINE
curl -s http://localhost:3100/assets | grep -o '"status":"[^"]*"' | sort | uniq -c
# Expected: 5 "status":"online"

# 3. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 4. Topology - 5 nodes, 4 links
curl -s http://localhost:3100/api/v1/monitoring/topology/network \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"totalDevices":[0-9]*,"totalConnections":[0-9]*'
# Expected: "totalDevices":5,"totalConnections":4

# 5. Top Talkers - traffic data
curl -s http://localhost:3100/api/v1/monitoring/top-talkers \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"count":[0-9]*'
# Expected: "count":5

# 6. Device health in database
psql -h localhost -p 5433 -U ems_admin -d ems_platform \
  -c "SELECT name, status FROM assets ORDER BY name;"
# Expected: all 5 devices with status = online
```

### 10.2 Full Verification Matrix

| # | Check                                    | Expected Result                    | Command/Method                |
|---|------------------------------------------|------------------------------------|-------------------------------|
| 1 | Asset count                              | 5 devices                          | `GET /assets`                 |
| 2 | All devices ONLINE                       | 5x status="online"                 | `GET /assets`                 |
| 3 | Dashboard metrics                        | CPU, Memory, BW populated          | `GET /api/v1/monitoring/dashboard/summary` |
| 4 | Topology nodes                           | 5 nodes                            | `GET /api/v1/monitoring/topology/network` |
| 5 | Topology links                           | 4 links (star from hub)            | `GET /api/v1/monitoring/topology/network` |
| 6 | Top Talkers                              | 5 devices with traffic             | `GET /api/v1/monitoring/top-talkers`      |
| 7 | Metrics updating                         | New rows every 30s                 | `SELECT count(*) FROM device_metrics_history` |
| 8 | Traffic flows accumulating               | Growing row count                  | `SELECT count(*) FROM traffic_flows`      |
| 9 | No demo data                             | 0 non-RailTel assets               | `SELECT count(*) FROM assets WHERE id::text NOT LIKE 'a0000001%'` |
| 10| Frontend loads                           | Login page renders                 | Browser: `http://localhost:5173` |

---

## 11. API Endpoint Reference

### Public Endpoints (No Auth)

| Method | Endpoint                | Description                    |
|--------|-------------------------|--------------------------------|
| GET    | `/assets`               | List all devices               |
| POST   | `/api/v1/auth/login`    | Authenticate and get JWT token |

### Probe Endpoints (API Key Auth)

| Method | Endpoint                          | Description                          |
|--------|-----------------------------------|--------------------------------------|
| POST   | `/api/v1/probe/ingest`            | Ingest device metrics from probe     |
| GET    | `/api/v1/probe/health`            | Probe ingestion service health       |
| GET    | `/api/v1/probe/:probeId/status`   | Status of a specific probe           |

### Protected Endpoints (Bearer Token Required)

| Method | Endpoint                                          | Description                      |
|--------|---------------------------------------------------|----------------------------------|
| GET    | `/api/v1/monitoring/dashboard/summary`            | Dashboard overview metrics       |
| GET    | `/api/v1/monitoring/dashboard/devices-by-status`  | Devices grouped by status        |
| GET    | `/api/v1/monitoring/dashboard/critical-devices`   | Devices with critical alerts     |
| GET    | `/api/v1/monitoring/dashboard/top-devices`        | Top devices by resource usage    |
| GET    | `/api/v1/monitoring/dashboard/sla-compliance`     | SLA compliance overview          |
| GET    | `/api/v1/monitoring/dashboard/device/:id/health`  | Single device health details     |
| GET    | `/api/v1/monitoring/topology/network`             | Full network topology (nodes + links) |
| GET    | `/api/v1/monitoring/top-talkers`                  | Top bandwidth consumers          |
| GET    | `/api/v1/monitoring/top-talkers/protocols`        | Traffic by protocol              |
| GET    | `/api/v1/monitoring/top-talkers/conversations`    | Top device-to-device flows       |
| GET    | `/api/v1/monitoring/top-talkers/stats/overview`   | Traffic statistics summary       |
| GET    | `/api/v1/security/overview`                       | Security posture overview        |
| GET    | `/api/v1/masters/devices`                         | Device master list               |

### Authentication

```bash
# Login
curl -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# Use the returned accessToken in subsequent requests
curl http://localhost:3100/api/v1/monitoring/dashboard/summary \
  -H "Authorization: Bearer <accessToken>"
```

---

## 12. Stability Management (2-Week PoC)

### 12.1 Known Growth Areas

The database will accumulate data over the 2-week period:

| Table                    | Growth Rate           | 2-Week Estimate   | Action              |
|--------------------------|-----------------------|-------------------|---------------------|
| `device_metrics_history` | 30 rows/min (6/device)| ~600,000 rows     | Monitor disk usage  |
| `traffic_flows`          | 5-10 rows/30s         | ~40,000 rows      | Auto-cleaned (24h)  |
| `events`                 | Minimal               | < 100 rows        | No action needed    |
| `device_health`          | 5 rows (updates only) | 5 rows            | No action needed    |

**Disk estimate:** ~600K metrics rows x ~200 bytes = ~120 MB. This is negligible.

### 12.2 Preventing Data Bloat

If `device_metrics_history` grows too large, run this cleanup weekly:

```sql
-- Keep only last 7 days of metrics
DELETE FROM device_metrics_history
WHERE timestamp < NOW() - INTERVAL '7 days';
```

### 12.3 Windows Power & Sleep Settings

**CRITICAL for 2-week stability:**

1. **Disable Sleep/Hibernate:**
   - Settings > System > Power > Screen and sleep
   - Set "When plugged in, put my device to sleep" to **Never**
   - Set "When plugged in, turn off my screen after" to **Never** (or a reasonable time)

2. **Disable Windows Auto-Updates Restart:**
   - Settings > Windows Update > Advanced options
   - Set active hours to cover your PoC demo times

3. **Keep the machine plugged in** at all times

### 12.4 Process Persistence

The current setup uses `npm run start:dev` (development mode with file watching). For a 2-week PoC:

**Option A: Keep dev mode (simplest)**
- Leave the terminal windows open
- If the machine restarts, re-run the startup procedure (Section 8)

**Option B: Use PM2 for auto-restart (recommended for stability)**

```bash
# Install PM2 globally
npm install -g pm2

# Start API with PM2
cd <repo-root>/apps/api
pm2 start "npm run start:dev" --name ems-api

# Start Frontend with PM2
cd <repo-root>/apps/web
pm2 start "npm run dev" --name ems-web

# Save PM2 process list (survives terminal close)
pm2 save

# Monitor processes
pm2 status
pm2 logs ems-api --lines 50

# Auto-start on Windows reboot (requires pm2-windows-startup)
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

### 12.5 Scheduled Health Check Script

Create a batch file `check-ems.bat` for quick validation:

```batch
@echo off
echo === EMS Platform Health Check ===
echo.
echo Checking API (port 3100)...
curl -s http://localhost:3100/assets | findstr /C:"online" >nul
if %errorlevel%==0 (
    echo [OK] API is running, devices are online
) else (
    echo [FAIL] API is not responding or devices are offline
)
echo.
echo Checking Frontend (port 5173)...
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Frontend is running
) else (
    echo [FAIL] Frontend is not responding
)
echo.
echo Checking device count...
curl -s http://localhost:3100/assets | findstr /C:"DM-Tuticorin" >nul
if %errorlevel%==0 (
    echo [OK] RailTel devices found
) else (
    echo [FAIL] Device data missing
)
echo.
echo === Check Complete ===
pause
```

---

## 13. Troubleshooting Guide

### 13.1 API Won't Start - Port Already In Use

```
Error: listen EADDRINUSE: address already in use :::3100
```

**Fix:**
```bash
# Find the process
netstat -ano | grep LISTENING.*3100
# Note the PID (last column)

# Kill it
taskkill /PID <PID> /F

# Restart API
cd apps/api && npm run start:dev
```

### 13.2 Devices Showing as OFFLINE

**Cause:** The SNMP monitor `pollDevice()` method threw an unhandled exception.

**Check logs:**
```bash
# Look for error messages in API console output
# Or check the API log file if using PM2:
pm2 logs ems-api --lines 100 | grep ERROR
```

**Quick fix:**
```sql
-- Force all devices online
UPDATE assets SET status = 'online' WHERE id::text LIKE 'a0000001%';
```

**Root cause fix:** Restart the API to reset the polling cycle.

### 13.3 Traffic Flows Not Generating

**Symptom:** Top Talkers page shows empty.

**Check:**
```sql
SELECT count(*) FROM traffic_flows WHERE timestamp > NOW() - INTERVAL '1 hour';
```

**If 0 rows:** The traffic flow generator may be crashing. Check API logs for:
```
[TrafficFlowGeneratorService] Failed to generate traffic flows: <error>
```

**Common cause:** `invalid input syntax for type inet` -- means the `destinationIp` fix (Section 7.2) was not applied.

### 13.4 Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5433
```

**Fix:** Ensure PostgreSQL is running:
```bash
# Windows: Check Services
# Start > services.msc > find "postgresql-x64-15" > Start

# Or via command line:
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start
```

### 13.5 Probe Agent Not Pushing Data

**Symptom:** Probe is running but no data appears in dashboard.

**Check probe health:**
```bash
curl http://localhost:3200/health
```

**Check API probe endpoint:**
```bash
curl http://localhost:3100/api/v1/probe/health
```

**Common causes:**
1. **Wrong API key** — Ensure `PROBE_API_KEY` matches in both `apps/probe/.env` and `apps/api/.env`
2. **API unreachable** — Check if the probe can reach the API URL. Look for "API unreachable" in probe logs
3. **Buffer full** — If the API was down for too long, check probe logs for "Buffer full" messages

**Check if data is arriving:**
```sql
SELECT count(*), max(timestamp) FROM device_metrics_history
WHERE metadata->>'dataSource' = 'probe';
```

### 13.6 Frontend Shows Blank Page or API Errors

1. Verify API is running: `curl http://localhost:3100/assets`
2. Check CORS: Ensure `CORS_ORIGINS` in `.env` includes the frontend URL
3. Clear browser cache and retry
4. Check browser console (F12) for specific errors

### 13.7 Metrics Not Updating (Stale Data)

**Symptom:** Dashboard shows the same values, not changing every 30 seconds.

**Check:**
```sql
SELECT max(timestamp), count(*)
FROM device_metrics_history
WHERE timestamp > NOW() - INTERVAL '5 minutes';
```

**If no recent rows:** The SNMP polling cron job has stopped. Restart the API.

---

## 14. Rollback Procedure

### 14.1 Revert SNMP Monitor to Production Mode

To restore the original behavior where SNMP failure = OFFLINE:

**File:** `apps/api/src/monitoring/services/snmp-monitor.service.ts`, lines 90-95

Change:
```typescript
isOnline = true;   // PoC mode
this.logger.warn(`${device.name}: SNMP unreachable, using simulated data (PoC mode)`);
```

Back to:
```typescript
isOnline = false;  // Production mode
this.logger.debug(`${device.name}: Using simulated data (SNMP failed)`);
```

### 14.2 Revert Probe-Managed Devices

To clear the probe flag and let the SNMP monitor poll these devices directly again:

```sql
UPDATE assets SET metadata = metadata - 'dataSource' - 'probeId' - 'snmpReachable'
WHERE metadata->>'dataSource' = 'probe';
```

### 14.3 Re-seed Demo Data

```bash
cd apps/api
npx ts-node -r dotenv/config src/scripts/seed.ts
```

### 14.4 Revert Environment to Demo Mode

In both `.env` files:
```env
DATA_MODE=demo
SNMP_MODE=simulation
```

---

## 15. Adapting for Future PoCs

This section outlines how to replicate this PoC setup for a different client with different devices.

### 15.1 Step-by-Step for New Client

#### Step 1: Prepare Device Inventory

Create an Excel/CSV with these columns:
- Device Name
- IP Address
- Device Type (router/switch/firewall)
- Location
- SNMP Community String
- SNMP Version (v1/v2c/v3)
- Vendor, Model
- Topology role (hub/spoke)

#### Step 2: Import Devices to Database

Use the existing import script or insert directly:

```sql
INSERT INTO assets (id, name, type, ip, location, vendor, model,
  tags, tier, owner, department, status, "monitoringEnabled", metadata)
VALUES (
  'b0000001-0001-0001-0001-000000000001',  -- Unique UUID prefix for this client
  'Device-Name',
  'router',
  '10.0.0.1',
  'City, State',
  'Cisco',
  'ISR 4331',
  ARRAY['client-tag', 'router'],
  2,
  'Client Name',
  'Network Operations',
  'offline',
  true,
  '{"snmp_community": "public", "snmp_version": "2c"}'::jsonb
);
```

> **Important:** Use a unique UUID prefix per client (e.g., `b0000001` for Client B, `c0000001` for Client C) so cleanup queries work with `LIKE` patterns.

#### Step 3: Define Topology

Insert connections into `device_connections` following the client's actual network topology (star, ring, mesh, etc.).

#### Step 4: Clean Previous Client Data

```sql
-- Replace 'a0000001' with previous client's UUID prefix
DELETE FROM device_connections WHERE source_asset_id::text LIKE 'a0000001%';
DELETE FROM device_health WHERE asset_id::text LIKE 'a0000001%';
DELETE FROM device_metrics_history WHERE asset_id::text LIKE 'a0000001%';
DELETE FROM traffic_flows WHERE asset_id::text LIKE 'a0000001%';
DELETE FROM events WHERE "assetId"::text LIKE 'a0000001%';
DELETE FROM assets WHERE id::text LIKE 'a0000001%';
```

#### Step 5: Configure SNMP

- If devices are SNMP-reachable: Set `SNMP_MODE=production` (real data used)
- If devices are NOT reachable: Apply the PoC resilience patch (Section 7.1)

#### Step 6: Update Environment and Restart

Follow Sections 4, 8, and 9.

### 15.2 Checklist Template for New PoCs

```
[ ] Device inventory spreadsheet prepared
[ ] UUID prefix chosen for new client (not conflicting with existing)
[ ] Devices inserted into assets table
[ ] Topology connections inserted
[ ] Previous client data cleaned (if reusing same DB)
[ ] SNMP reachability tested (ping + snmpwalk)
[ ] SNMP_MODE configured (production or simulation)
[ ] PoC resilience patch applied (if SNMP unreachable)
[ ] DATA_MODE set to production
[ ] Fresh events inserted for new devices
[ ] API started and verified (5 checks from Section 9)
[ ] Frontend started and accessible
[ ] Client login credentials provided
[ ] Windows sleep/hibernate disabled
[ ] PM2 or process persistence configured
[ ] Health check script prepared
```

---

## 16. Appendix

### 16.1 Database Schema (Key Tables)

| Table                    | Purpose                                    | Key Columns                |
|--------------------------|--------------------------------------------|----------------------------|
| `assets`                 | Device inventory                           | id, name, ip, type, status |
| `device_health`          | Real-time health metrics per device        | asset_id, cpu, memory, bw  |
| `device_metrics_history` | Time-series metrics (30s intervals)        | asset_id, metric_type, value, timestamp |
| `device_connections`     | Network topology links                     | source_asset_id, destination_asset_id |
| `traffic_flows`          | Network traffic data for top talkers       | asset_id, source_ip, bytes_in/out |
| `events`                 | System events (device up/down, alerts)     | assetId, severity, title   |
| `alerts`                 | Active alerts derived from events          | eventId, status, slaDeadline |

### 16.2 Key Source Files

| File                                                          | Purpose                              |
|---------------------------------------------------------------|--------------------------------------|
| `apps/api/src/monitoring/services/snmp-monitor.service.ts`    | SNMP polling, device health updates  |
| `apps/api/src/monitoring/services/traffic-flow-generator.service.ts` | Traffic flow generation       |
| `apps/api/src/monitoring/controllers/dashboard.controller.ts` | Dashboard API endpoints              |
| `apps/api/src/monitoring/controllers/topology.controller.ts`  | Topology API endpoint                |
| `apps/api/src/monitoring/controllers/top-talkers.controller.ts` | Top talkers API endpoints          |
| `apps/api/src/entities/asset.entity.ts`                       | Asset/Device entity definition       |
| `apps/api/src/entities/device-health.entity.ts`               | Device health entity                 |
| `apps/api/src/probe/probe.controller.ts`                      | Probe ingestion API endpoints        |
| `apps/api/src/probe/probe.service.ts`                         | Probe data processing & DB writes    |
| `apps/api/src/probe/guards/api-key.guard.ts`                  | Probe API key authentication         |
| `apps/probe/src/snmp-poller.service.ts`                       | Remote SNMP polling service          |
| `apps/probe/src/api-pusher.service.ts`                        | Metric push with buffer & retry      |
| `apps/probe/src/probe-orchestrator.service.ts`                | Poll + push orchestration (30s cron) |
| `apps/probe/src/config.ts`                                    | RailTel device list with UUIDs       |
| `apps/api/.env`                                               | API environment configuration        |
| `apps/probe/.env`                                             | Probe agent configuration            |
| `.env`                                                        | Root environment configuration       |

### 16.3 Useful Database Queries

```sql
-- Device status overview
SELECT name, status, ip FROM assets ORDER BY name;

-- Current health metrics
SELECT a.name, dh.status, dh.cpu_utilization, dh.memory_utilization,
       dh.bandwidth_in_mbps, dh.latency_ms, dh.last_health_check
FROM device_health dh
JOIN assets a ON a.id = dh.asset_id
ORDER BY a.name;

-- Metrics history count (check if polling is working)
SELECT count(*), max(timestamp) as latest
FROM device_metrics_history;

-- Traffic flow count (check if traffic generator is working)
SELECT count(*), max(timestamp) as latest
FROM traffic_flows;

-- Topology connections
SELECT a1.name as source, a2.name as destination,
       dc.link_status, dc.link_speed_mbps, dc.protocol
FROM device_connections dc
JOIN assets a1 ON a1.id = dc.source_asset_id
JOIN assets a2 ON a2.id = dc.destination_asset_id;

-- Data growth monitoring
SELECT 'metrics' as table_name, count(*) as rows,
       pg_size_pretty(pg_total_relation_size('device_metrics_history')) as size
FROM device_metrics_history
UNION ALL
SELECT 'traffic_flows', count(*),
       pg_size_pretty(pg_total_relation_size('traffic_flows'))
FROM traffic_flows;
```

### 16.4 Emergency Quick-Restart Script

Save as `restart-ems.sh` (Git Bash):

```bash
#!/bin/bash
echo "=== Stopping existing processes ==="

# Kill API on port 3100
PID=$(netstat -ano | grep "LISTENING.*:3100" | awk '{print $5}' | head -1)
if [ -n "$PID" ]; then
    echo "Killing API process (PID: $PID)"
    taskkill //PID $PID //F 2>/dev/null
    sleep 2
fi

# Kill Frontend on port 5173
PID=$(netstat -ano | grep "LISTENING.*:5173" | awk '{print $5}' | head -1)
if [ -n "$PID" ]; then
    echo "Killing Frontend process (PID: $PID)"
    taskkill //PID $PID //F 2>/dev/null
    sleep 2
fi

echo "=== Starting API ==="
cd /c/Users/RCIL_MS_B74EVER2/projects/ems-platform/apps/api
npm run start:dev &
sleep 20

echo "=== Starting Frontend ==="
cd /c/Users/RCIL_MS_B74EVER2/projects/ems-platform/apps/web
npm run dev &
sleep 5

echo "=== Verifying ==="
curl -s http://localhost:3100/assets | grep -o '"status":"online"' | wc -l
echo "devices online (expected: 5)"

echo "=== Done ==="
echo "Frontend: http://localhost:5173"
echo "API:      http://localhost:3100"
```

---

*End of SOP Document*

*Prepared for: RailTel Corporation of India Ltd - Network Monitoring PoC*
*Platform: Canaris EMS Platform v0.1.0*
*Classification: Internal / Client Confidential*
