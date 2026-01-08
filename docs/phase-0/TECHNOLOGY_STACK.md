# Technology Stack - LOCKED DECISIONS

**Status:** ✅ LOCKED - No changes after Phase 0  
**Date:** January 8, 2026  
**Author:** Pramod + Claude

---

## Core Platform

### Backend Framework
- **Node.js v24+** with **NestJS**
- **TypeScript** (strict mode)
- **Why:** Proven velocity with existing NMS, enterprise structure, type safety

### Frontend Framework
- **React 18** with **TypeScript**
- **UI Library:** Ant Design or Material UI
- **State:** React Context / Zustand (no Redux)
- **Charts:** Recharts (already proven in NMS)
- **Why:** Reuse existing components, large ecosystem

### Primary Database
- **PostgreSQL 15**
- Hypertables for time-series data
- JSONB for flexible schema
- **Why:** ACID compliance, proven reliability, JSON support

### Cache & Messaging
- **Redis 7+**
- Redis Streams for event messaging
- Pub/Sub for real-time updates
- **Why:** Fast, simple, no Kafka complexity needed for PoC

---

## AI/ML Stack

### ML Framework
- **Python 3.11+** with **scikit-learn**
- **Algorithms:** Random Forest (RCA), DBSCAN (clustering)
- **Why:** Lightweight, battle-tested, no TensorFlow overkill

### ML Service
- **FastAPI** (Python)
- REST API for inference
- **Why:** Fast, modern, easy integration with NestJS

### Training Pipeline
- **pandas** for data prep
- **joblib** for model serialization
- Weekly retraining schedule
- **Why:** Simple, reliable, production-ready

---

## Cloud & Monitoring

### AWS Integration
- **AWS SDK for JavaScript (v3)**
- **CloudWatch API** for metrics
- **EC2/RDS APIs** for discovery
- **Why:** Official SDK, comprehensive

### APM Instrumentation
- **OpenTelemetry**
- Auto-instrumentation for Node.js/Java/Python
- **OpenTelemetry Collector** for aggregation
- **Why:** Vendor-neutral, industry standard

### Synthetic Monitoring
- **Playwright**
- Headless browser automation
- **Why:** Modern, fast, reliable

---

## Infrastructure

### Containerization
- **Docker** + **Docker Compose**
- Multi-stage builds
- Health checks on all services
- **Why:** Simple deployment, proven with NMS

### Development Tools
- **VS Code** (recommended)
- **ESLint** + **Prettier**
- **Husky** for Git hooks
- **Why:** Industry standard

---

## What We're NOT Using (And Why)

❌ **Kafka** - Over-engineering for PoC (Redis Streams sufficient)  
❌ **Kubernetes** - Docker Compose adequate for Phase 1  
❌ **TensorFlow** - Too heavy for correlation use case  
❌ **Microservices mesh** - Adds complexity, not needed yet  
❌ **GraphQL** - REST is simpler and sufficient  

---

## Version Requirements

| Component | Min Version | Reason |
|-----------|-------------|--------|
| Node.js | v18.0.0 | Native fetch, performance |
| PostgreSQL | 15.0 | JSON improvements |
| Redis | 7.0 | Redis Streams stability |
| Python | 3.11 | Performance, type hints |
| Docker | 20.10 | Compose v2 features |

---

## ⚠️ CRITICAL RULE

**These decisions are LOCKED.** No debates, no "what if we used X instead?"

If you want to change anything, you must:
1. Document WHY the change is critical
2. Get approval in Phase 0 review
3. Update this document with rationale

**No technology changes after Phase 0 ends.**

---

**Locked by:** Pramod  
**Date:** January 8, 2026