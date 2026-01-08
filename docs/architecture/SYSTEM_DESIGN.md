# EMS Platform - System Architecture

**Version:** 1.0  
**Date:** January 8, 2026  
**Author:** Pramod + Claude  
**Status:** Phase 0 Complete ✅

---

## High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     WEB BROWSER (React)                     │
│                   Unified Dashboard UI                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   EMS CORE API (NestJS)                     │
│          Assets | Events | Alerts | Metrics | Auth         │
└─┬───────┬────────┬────────┬────────┬────────┬──────────┬───┘
  │       │        │        │        │        │          │
  │ REST  │  REST  │  REST  │  REST  │  REST  │   REST   │
  ▼       ▼        ▼        ▼        ▼        ▼          ▼
┌───┐  ┌────┐  ┌─────┐  ┌────┐  ┌────┐  ┌──────┐  ┌──────┐
│NMS│  │Cloud│ │ ML  │  │APM │  │ITSM│  │      │  │      │
│   │  │Mon  │ │ AI  │  │Lite│  │Lite│  │Future│  │Future│
└─┬─┘  └──┬─┘  └──┬──┘  └──┬─┘  └──┬─┘  └──────┘  └──────┘
  │       │       │        │       │
  └───────┴───────┴────────┴───────┘
          │ Redis Streams (Event Bus)
          ▼
  ┌──────────────────────┐
  │   Redis (Cache +     │
  │   Event Streaming)   │
  └──────────────────────┘
          │
          ▼
  ┌──────────────────────┐      ┌──────────────────┐
  │   PostgreSQL 15      │      │  Elasticsearch   │
  │ (Primary Database)   │      │  (SIEM Logs)     │
  └──────────────────────┘      └──────────────────┘
```

---

## Module Responsibilities

### EMS Core (apps/api)
**Port:** 3000  
**Tech:** NestJS + TypeScript + PostgreSQL

**Owns:**
- Asset management (canonical source of truth)
- Event ingestion and normalization
- Alert lifecycle management
- User authentication and RBAC
- Metric storage and querying
- API Gateway for all modules

**Does NOT:**
- Poll devices (that's NMS)
- Run ML models (that's ML service)
- Collect logs (that's SIEM)

---

### NMS Module (apps/nms)
**Port:** 3001  
**Tech:** Node.js + SNMP + Refactored from existing

**Responsibilities:**
- SNMP device polling (routers, switches, firewalls)
- Network metric collection (bandwidth, latency, packet loss)
- Device discovery and inventory
- Threshold monitoring
- Emit events to EMS Core when issues detected

**Key Changes from Standalone:**
- No longer owns device master data (uses EMS Core Assets)
- No longer owns alerts (creates Events in EMS Core)
- No longer has users (uses EMS Core Auth)

---

### Cloud Monitoring (apps/cloud)
**Port:** 3002  
**Tech:** Node.js + AWS SDK + CloudWatch API

**Responsibilities:**
- AWS EC2 instance monitoring
- AWS RDS health checks
- CloudWatch metric collection
- Multi-region support
- Cloud resource discovery
- Emit events for state changes

---

### ML/AI Correlation (apps/ml)
**Port:** 3003  
**Tech:** Python + FastAPI + scikit-learn

**Responsibilities:**
- Root cause analysis (Random Forest)
- Alert clustering (DBSCAN)
- Business impact calculation
- Pattern detection
- Model training and retraining
- Explainable AI outputs

**Key Algorithms:**
- Random Forest for RCA (70%+ accuracy target)
- DBSCAN for clustering (30-40% alert reduction)
- Time series analysis for patterns

---

### APM Lite (apps/apm)
**Port:** 3004  
**Tech:** Node.js + OpenTelemetry

**Responsibilities:**
- Application availability monitoring
- Response time tracking (P50/P95/P99)
- Error rate monitoring
- Dependency mapping
- Synthetic checks (Playwright)
- Transaction tracing

**What it's NOT:**
- NOT full APM (no code-level profiling)
- NOT distributed tracing visualization
- Focus on availability + performance only

---

### ITSM Lite (apps/itsm)
**Port:** 3005  
**Tech:** Node.js + NestJS

**Responsibilities:**
- Ticket management (Incident/Problem/Change)
- Auto-ticket creation from alerts
- SLA tracking and breach warnings
- Assignment and routing
- Comment threads
- Status transitions

---

## Data Flow Examples

### Example 1: Device Down Detection
```
1. NMS polls router → No response (3 retries)
2. NMS creates Event:
   POST /api/v1/events
   {
     source: 'nms',
     severity: 'critical',
     title: 'Device Unreachable',
     assetId: 'ast_router_01'
   }

3. EMS Core receives Event:
   - Checks for existing alert with same fingerprint
   - Creates new Alert (or updates occurrence count)
   - Publishes to Redis Stream

4. ML Service consumes from Redis Stream:
   - Analyzes recent events
   - Predicts root cause (this router)
   - Calculates business impact score
   - Updates Alert with enrichment

5. ITSM Service consumes from Redis Stream:
   - Checks if alert severity = critical
   - Auto-creates Ticket
   - Links to Alert
   - Starts SLA countdown

6. Frontend polls /api/v1/alerts:
   - Shows alert with:
     ✓ Business impact: 72/100
     ✓ Root cause: Router (87% confidence)
     ✓ Revenue at risk: $25K/hour
     ✓ Auto-created ticket #1234
     ✓ SLA: 12 minutes remaining
```

---

### Example 2: Application Slow Response
```
1. APM module monitors Payment API:
   - Detects P95 response time > 2000ms (threshold: 500ms)
   
2. APM creates Event:
   POST /api/v1/events
   {
     source: 'apm',
     severity: 'warning',
     title: 'High Response Time',
     assetId: 'ast_payment_api',
     metadata: {
       p95_latency: 2100,
       threshold: 500,
       endpoint: '/api/payments'
     }
   }

3. EMS Core creates Alert

4. ML Service:
   - Looks for correlated events
   - Finds: Database CPU high + Payment API slow
   - Root cause: Database (database causing API slowness)
   - Impact: Medium (not down, just slow)

5. Operator sees:
   - Alert: Payment API slow
   - Root cause: Database CPU high (correlation)
   - Action: Scale database or optimize queries
```

---

## Technology Stack Summary

### Languages
- **TypeScript** - Backend services (NestJS)
- **JavaScript/TypeScript** - Frontend (React)
- **Python** - ML/AI service

### Frameworks
- **NestJS** - Backend (API, NMS, Cloud, ITSM, APM)
- **React 18** - Frontend
- **FastAPI** - ML service

### Databases
- **PostgreSQL 15** - Primary (assets, events, alerts, metrics)
- **Redis 7** - Cache + Event streaming
- **Elasticsearch 8** - SIEM logs (future)

### Infrastructure
- **Docker Compose** - Container orchestration
- **Node.js v24** - Runtime
- **Python 3.11** - ML runtime

### Monitoring Protocols
- **SNMP v2c/v3** - Network devices
- **WMI/SSH** - Servers (future)
- **AWS SDK** - Cloud resources
- **OpenTelemetry** - Applications

---

## Deployment Architecture

### Development (Current)
```
docker-compose.yml:
  - postgres (port 5432)
  - redis (port 6379)
  - ems-core (port 3000)
  - nms-module (port 3001)
  - cloud-module (port 3002)
  - ml-service (port 3003)
  - apm-module (port 3004)
  - itsm-module (port 3005)
  - frontend (port 5173)
```

### Production (Future)
```
- Load balancer (Nginx)
- Multiple API instances (horizontal scaling)
- PostgreSQL primary + replicas
- Redis cluster
- Centralized logging
- Prometheus + Grafana for self-monitoring
```

---

## Security Architecture

### Authentication
- **JWT tokens** (Bearer auth)
- **Expiry:** 8 hours
- **Refresh tokens:** 30 days
- **Storage:** HTTP-only cookies

### Authorization (RBAC)
- **Admin** - Full access (*)
- **Operator** - Read + Write operational data
- **Viewer** - Read-only

### API Security
- **Rate limiting:** 100 req/min per user
- **CORS:** Configured origins only
- **HTTPS:** Required in production
- **API keys:** For module-to-module communication

---

## Scalability Plan

### Phase 1 (MVP) - Target: 500 assets
- Single instance of each service
- PostgreSQL on single node
- Redis single instance
- Handles: 500 assets, 10K alerts/day

### Phase 2 (Production) - Target: 2000 assets
- Horizontally scaled API (3+ instances)
- PostgreSQL primary + 2 replicas
- Redis cluster (3 nodes)
- Handles: 2K assets, 50K alerts/day

### Phase 3 (Enterprise) - Target: 10K+ assets
- Kubernetes orchestration
- PostgreSQL sharding
- Elasticsearch cluster
- Handles: 10K+ assets, 200K+ alerts/day

---

## Monitoring Self-Monitoring

**Yes, the EMS monitors itself!**
```
1. Each module exposes /health endpoint
2. EMS Core polls all modules every 30 seconds
3. If module unhealthy → Create alert
4. Self-monitoring alerts marked with special tag
5. Email notifications for platform health issues
```

---

## Phase 0 Decisions Locked ✅

This document references the locked decisions in:
- `docs/phase-0/TECHNOLOGY_STACK.md`
- `docs/phase-0/DATA_MODELS.md`
- `docs/phase-0/MODULE_CONTRACTS.md`
- `docs/phase-0/AI_ML_STRATEGY.md`
- `docs/phase-0/BUSINESS_IMPACT_SCORING.md`

**All architectural decisions are FINAL.**

Next: Phase 1 - Build EMS Core v0.1

---

**Approved by:** Pramod  
**Date:** January 8, 2026  
**Phase 0:** COMPLETE ✅