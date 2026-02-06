# Session 8 Summary: Priority 6 - Deployment & DATA_MODE Switch

**Date**: February 6, 2026
**Duration**: ~2 hours
**Focus**: Docker setup, CI/CD pipeline, production readiness, DATA_MODE environment switch

---

## Objectives Completed

### 1. UI Enhancements (Bug Fixes)
- [x] Fixed CANARIS logo visibility (removed CSS filter making it invisible)
- [x] Removed demo credentials from login page
- [x] Fixed device count mismatch in SLA reports (isCritical based on tier, not health score)
- [x] Added 12 sample report history records for Reports page

### 2. Docker Setup
- [x] Created multi-stage Dockerfile for API (`apps/api/Dockerfile`)
- [x] Created multi-stage Dockerfile for Web (`apps/web/Dockerfile`)
- [x] Created development Docker Compose (`docker-compose.yml`)
- [x] Created production Docker Compose overrides (`docker-compose.prod.yml`)
- [x] Created `.dockerignore` for optimized builds
- [x] Created nginx production config (`apps/web/nginx.conf`)

### 3. CI/CD Pipeline (GitHub Actions)
- [x] Created CI workflow (`ci.yml`) - lint, test, build on PR/push
- [x] Created Deploy workflow (`deploy.yml`) - build/push Docker images, staging/production deployments
- [x] Configured GitHub Container Registry (ghcr.io) integration

### 4. Production Readiness
- [x] Added Helmet.js security headers
- [x] Added compression middleware
- [x] Configured graceful shutdown (SIGTERM/SIGINT handlers)
- [x] Set up TypeORM migrations (`data-source.ts`)
- [x] Created comprehensive deployment guide for 2000+ devices

### 5. DATA_MODE Environment Switch
- [x] Implemented `DATA_MODE=demo|production` toggle
- [x] Updated SecuritySimulatorService with `isSimulationEnabled()` check
- [x] Updated TrafficFlowGeneratorService to respect DATA_MODE
- [x] Updated AlertGeneratorService to log current mode
- [x] Added Joi validation for DATA_MODE
- [x] Documented DATA_MODE in deployment guide

### 6. GitHub Repository
- [x] Pushed to https://github.com/CWPramod/ems-platform.git

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/Dockerfile` | Multi-stage build for NestJS API |
| `apps/web/Dockerfile` | Multi-stage build for React + nginx |
| `apps/web/nginx.conf` | Production nginx with gzip, security headers |
| `docker-compose.yml` | Development stack |
| `docker-compose.prod.yml` | Production overrides |
| `.dockerignore` | Exclude node_modules, .git, etc. |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/deploy.yml` | Deployment pipeline |
| `apps/api/src/config/data-source.ts` | TypeORM migrations config |
| `docs/DEPLOYMENT-GUIDE.md` | Comprehensive deployment guide |

## Files Modified

| File | Changes |
|------|---------|
| `.env.example` | Added DATA_MODE variable |
| `apps/api/src/main.ts` | Added Helmet, compression, graceful shutdown |
| `apps/api/src/config/env.validation.ts` | Added DATA_MODE Joi validation |
| `apps/api/src/security/services/security-simulator.service.ts` | Added DATA_MODE checks |
| `apps/api/src/monitoring/services/traffic-flow-generator.service.ts` | Added DATA_MODE support |
| `apps/api/src/alerts/alert-generator.service.ts` | Added DATA_MODE logging |
| `apps/api/src/scripts/seed.ts` | Fixed isCritical logic, added report history |
| `apps/web/src/components/CanarisLogo.tsx` | Fixed logo visibility |
| `apps/web/src/pages/Login.tsx` | Removed demo credentials |
| `apps/api/src/reporting/reports/reports.controller.ts` | Transform response for frontend |

---

## DATA_MODE Switch Details

### Purpose
Toggle between demo data generation and production-only mode.

### Environment Variables

```bash
# For demos (default)
DATA_MODE=demo
SNMP_MODE=simulation

# For production
DATA_MODE=production
SNMP_MODE=production
```

### Services Controlled

| Service | Demo Mode | Production Mode |
|---------|-----------|-----------------|
| **SecuritySimulatorService** | | |
| - simulateIocMatches() | Every 3 min | DISABLED |
| - simulateSignatureAlerts() | Every 30 sec | DISABLED |
| - simulateDdosEvents() | Every 2 min | DISABLED |
| - updateSslCertificates() | Every 5 min | Every 5 min |
| **TrafficFlowGeneratorService** | | |
| - generateTrafficFlows() | Simulated flows | Real SNMP aggregation |
| **AlertGeneratorService** | | |
| - checkForAlerts() | Runs (simulated data) | Runs (real data) |

### How It Works

```typescript
// security-simulator.service.ts
private isSimulationEnabled(): boolean {
  return this.dataMode === 'demo';
}

@Cron('0 */3 * * * *')
async simulateIocMatches(): Promise<void> {
  if (!this.isSimulationEnabled()) return;  // Skip in production
  // ... simulation logic
}
```

---

## Commits Made

1. **UI fixes + seed updates**
   - Fixed logo, removed demo creds, fixed device count, added report history

2. **Priority 6: Deployment infrastructure**
   - Docker, CI/CD, production readiness
   - Commit: `32d83df`

3. **DATA_MODE switch**
   - Environment toggle for demo vs production
   - Commit: `046f278`

---

## Deployment Quick Reference

### Local Development
```bash
cd apps/api && npm run start:dev
cd apps/web && npm run dev
```

### Docker Development
```bash
docker compose up -d
```

### Docker Production
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Operations
```bash
# Run migrations
docker compose exec api npm run migration:run

# Seed demo data
docker compose exec api npm run seed
```

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `DATA_MODE=production`
- [ ] Set `SNMP_MODE=production`
- [ ] Generate strong `JWT_SECRET` (64+ chars)
- [ ] Generate strong `LICENSE_SIGNING_SECRET` (64+ chars)
- [ ] Configure `DATABASE_PASSWORD`
- [ ] Set up SSL certificates
- [ ] Configure firewall rules (SNMP UDP 161, HTTPS 443)
- [ ] Configure SNMP on all monitored devices
- [ ] Activate CANARIS license key

---

## GitHub Repository

**URL**: https://github.com/CWPramod/ems-platform.git
**Branch**: master

```bash
# Clone
git clone https://github.com/CWPramod/ems-platform.git

# Pull latest
git pull origin master
```

---

## Next Steps (Remaining Work)

1. **Phase 6 (Deferred)**: SSH/CLI remote device access
2. **Bundle optimization**: Code-splitting for frontend
3. **Real SNMP testing**: Test with actual network devices
4. **Load testing**: Verify 2000 device capacity

---

## Session Statistics

| Metric | Value |
|--------|-------|
| Files created | 10 |
| Files modified | 10 |
| Lines added | ~1,500 |
| Commits | 3 |
| Tests passing | 134 (20 suites) |
| Build status | Clean |
