# CLAUDE.md — EMS Platform / ITSM Lite Module

**Project:** EMS-Platform  
**Module:** ITSM Lite (`apps/itsm`)  
**Port:** 3005  
**Author:** Pramod  
**Created:** February 2026  

---

## 1. What is This Project?

EMS-Platform is a modular Enterprise Monitoring System. The ITSM Lite module provides operations-centric IT Service Management — tightly integrated with EMS alerts, assets, ML-based Root Cause Analysis (RCA), and business impact scoring.

**ITSM Lite is NOT:**
- A full ServiceNow clone or heavy ITIL bureaucracy tool
- A standalone ticketing system — it depends on EMS Core for assets, users, and alerts
- A CMDB — asset master data lives in EMS Core

**ITSM Lite IS:**
- An operational ITSM module for NOC/SOC teams, infrastructure teams, mid-size enterprises, government data centers, and MSP/MSSP providers
- Tightly coupled with EMS observability (alerts → tickets → RCA → resolution)
- Designed for speed-to-resolution, not process overhead

---

## 2. Tech Stack (Locked Decisions — Do Not Change)

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v24 |
| Framework | NestJS + TypeScript |
| Database | PostgreSQL 15 |
| Cache / Event Bus | Redis 7 (Redis Streams) |
| Frontend | React 18 (shared with EMS platform) |
| Container | Docker Compose |
| Auth | JWT (from EMS Core — ITSM does NOT own auth) |
| API Style | REST (JSON) |

---

## 3. Architecture & Module Boundaries

```
┌─────────────────────────────────┐
│     React Frontend (port 5173)  │
│   Ticket UI + SLA Dashboard     │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────┐
│    ITSM Module - NestJS (3005)  │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Ticket    │ │ SLA Engine   │ │
│  │ Service   │ │ (Cron Job)   │ │
│  └───────────┘ └──────────────┘ │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Redis     │ │ Problem/     │ │
│  │ Consumer  │ │ Change Svc   │ │
│  └───────────┘ └──────────────┘ │
└───────┬─────────────┬───────────┘
        │             │
   PostgreSQL    Redis Streams
        │             │
        ▼             ▼
 ┌────────────┐ ┌──────────────┐
 │ ITSM Tables│ │ EMS Core     │
 │ (tickets,  │ │ Event/Alert  │
 │  sla, etc.)│ │ Streams      │
 └────────────┘ └──────┬───────┘
                       │
                  EMS Core API (port 3000)
                       │
                 Assets | Alerts | Users
```

### Critical Boundaries
- **ITSM owns:** Tickets, SLA policies, comments, history, problems, changes, KB articles
- **ITSM consumes (read-only):** Assets, Alerts, Users, ML/RCA data — all via EMS Core API
- **ITSM publishes:** Ticket lifecycle events back to Redis Streams
- **ITSM never:** Stores user master data, duplicates asset records, or runs its own auth

---

## 4. Database Schema (PostgreSQL 15)

### 4.1 tickets
```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) CHECK (type IN ('incident', 'problem', 'change')),
  severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  priority VARCHAR(10) CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  status VARCHAR(30) CHECK (status IN ('open', 'acknowledged', 'in_progress', 'pending', 'resolved', 'closed')),
  asset_id UUID,           -- References EMS Core asset (not FK — cross-service)
  alert_id UUID,           -- References EMS Core alert (not FK — cross-service)
  assigned_to UUID,        -- References EMS Core user
  created_by UUID NOT NULL,-- References EMS Core user
  sla_policy_id UUID REFERENCES sla_policies(id),
  sla_due_at TIMESTAMP WITH TIME ZONE,
  breached BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'auto_alert', 'email', 'api')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Required indexes
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_sla_due_at ON tickets(sla_due_at) WHERE breached = FALSE;
CREATE INDEX idx_tickets_alert_id ON tickets(alert_id);
CREATE INDEX idx_tickets_asset_id ON tickets(asset_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_type ON tickets(type);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
```

### 4.2 ticket_comments
```sql
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  visibility VARCHAR(20) CHECK (visibility IN ('public', 'internal')) DEFAULT 'internal',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
```

### 4.3 ticket_history (Audit Trail)
```sql
CREATE TABLE ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  field_changed VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_history_ticket_id ON ticket_history(ticket_id);
```

### 4.4 sla_policies
```sql
CREATE TABLE sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  response_time_minutes INT NOT NULL,
  resolution_time_minutes INT NOT NULL,
  escalation_level_1_minutes INT NOT NULL,
  escalation_level_2_minutes INT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sla_policies_default_severity ON sla_policies(severity) WHERE is_default = TRUE;
```

### 4.5 problems
```sql
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  root_cause TEXT,
  status VARCHAR(30) CHECK (status IN ('open', 'investigating', 'known_error', 'resolved', 'closed')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.6 changes
```sql
CREATE TABLE changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  approval_status VARCHAR(30) CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'implemented', 'rolled_back')),
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.7 kb_articles
```sql
CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version INT DEFAULT 1,
  status VARCHAR(20) CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.8 ticket_links (Cross-references)
```sql
CREATE TABLE ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  link_type VARCHAR(30) CHECK (link_type IN ('related', 'duplicate', 'caused_by', 'parent_child')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_ticket_id, target_ticket_id, link_type)
);

CREATE INDEX idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX idx_ticket_links_target ON ticket_links(target_ticket_id);
```

---

## 5. Ticket Status Lifecycle (State Machine)

Enforce these transitions at the service layer. Reject any transition not listed here.

```
  ┌──────┐    acknowledge    ┌──────────────┐
  │ open │ ───────────────► │ acknowledged │
  └──┬───┘                  └──────┬───────┘
     │                             │
     │ assign + start work         │ start work
     │                             │
     ▼                             ▼
  ┌─────────────┐          ┌─────────────┐
  │ in_progress │ ◄────────│ in_progress │
  └──────┬──────┘          └─────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌─────────┐ ┌──────────┐
│ pending │ │ resolved │
└────┬────┘ └─────┬────┘
     │            │
     │ resume     │ confirm/auto-close (72h)
     ▼            ▼
┌─────────────┐ ┌────────┐
│ in_progress │ │ closed │
└─────────────┘ └────────┘
```

### Allowed Transitions
| From | To | Trigger |
|------|----|---------|
| `open` | `acknowledged` | Operator acknowledges |
| `open` | `in_progress` | Direct assignment + start |
| `acknowledged` | `in_progress` | Work begins |
| `in_progress` | `pending` | Awaiting info/vendor/change |
| `in_progress` | `resolved` | Fix applied |
| `pending` | `in_progress` | Info received / resumed |
| `resolved` | `closed` | Confirmed or auto-close after 72 hours |
| `resolved` | `in_progress` | Reopened (issue recurred) |

### Rules
- SLA clock **pauses** when status = `pending`
- SLA clock **stops** when status = `resolved` or `closed`
- Moving to `resolved` requires `resolution_notes` to be non-empty
- Every status change must be recorded in `ticket_history`
- Closed tickets cannot be reopened — create a new linked ticket instead

---

## 6. SLA Engine

### How It Works
1. Ticket is created (manual or auto from alert)
2. SLA policy is selected by matching ticket severity to `sla_policies.severity`
3. `sla_due_at` is calculated as `created_at + resolution_time_minutes`
4. A NestJS cron job (`@Cron('*/60 * * * * *')`) runs every 60 seconds
5. For each open/in-progress ticket where `now() > sla_due_at`:
   - Set `breached = TRUE`
   - Record in `ticket_history`
   - Publish escalation event to Redis Stream

### Escalation Logic
```
for each ticket WHERE status NOT IN ('resolved', 'closed') AND breached = FALSE:
  elapsed = now() - ticket.created_at (excluding pending time)
  
  if elapsed > escalation_level_1_minutes AND not already escalated L1:
    → Notify L1 manager (email/webhook)
    → Record escalation in ticket_history
  
  if elapsed > escalation_level_2_minutes AND not already escalated L2:
    → Notify L2 manager (email/webhook)
    → Record escalation in ticket_history
  
  if elapsed > resolution_time_minutes:
    → Mark breached = TRUE
    → Publish breach event to Redis Stream
```

### Default SLA Policies (Seed Data)
| Severity | Response | Resolution | Escalation L1 | Escalation L2 |
|----------|----------|------------|----------------|----------------|
| critical | 15 min | 60 min | 30 min | 45 min |
| high | 30 min | 240 min | 120 min | 180 min |
| medium | 60 min | 480 min | 360 min | 420 min |
| low | 240 min | 1440 min | 720 min | 1200 min |

### SLA KPIs to Track
- **MTTR** — Mean Time To Resolution
- **MTTA** — Mean Time To Acknowledge
- **SLA Compliance %** — (non-breached / total) × 100
- **Escalation Frequency** — escalations per time period
- **Breach Rate per Severity** — breaches grouped by severity

---

## 7. Redis Streams Integration

### Consuming Alerts from EMS Core
- **Stream key:** `ems:alerts:stream`
- **Consumer group:** `itsm-consumer-group`
- **Consumer name:** `itsm-worker-{instance_id}`
- **Read strategy:** Block read with `XREADGROUP`, acknowledge after successful ticket creation

### Auto-Ticket Creation Rules
| Alert Severity | Action |
|---------------|--------|
| `critical` | Auto-create ticket immediately |
| `high` | Auto-create ticket immediately |
| `warning` | Do NOT auto-create (operator decides) |
| `info` | Ignore |

### Deduplication
- Before creating a ticket, check: `SELECT id FROM tickets WHERE alert_id = $1 AND status NOT IN ('closed')`
- If an open ticket already exists for this alert, skip creation (log it)
- If the alert auto-resolves and the ticket is still `open`, add a comment noting alert resolution but do NOT auto-close the ticket (operator must verify)

### Publishing ITSM Events
- **Stream key:** `ems:itsm:stream`
- Publish events for: ticket_created, ticket_status_changed, ticket_breached, ticket_resolved, ticket_closed

---

## 8. EMS Core API Contracts (ITSM Consumes These)

ITSM calls EMS Core (`http://ems-core:3000/api/v1/`) for:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/assets/:id` | GET | Fetch asset details for ticket context |
| `/alerts/:id` | GET | Fetch alert details for linked view |
| `/alerts/:id` | PATCH | Update alert status when ticket resolves |
| `/users/:id` | GET | Fetch user info for assignment/display |
| `/users?role=operator` | GET | List assignable operators |
| `/events` | POST | Create event (for ITSM-originated events) |

Use an HTTP client service (e.g., NestJS `HttpModule` with Axios) with:
- Retry logic (3 attempts, exponential backoff)
- Circuit breaker for resilience
- API key header: `X-Module-Key: {ITSM_MODULE_API_KEY}`

---

## 9. ITSM REST API Endpoints (ITSM Exposes These)

All endpoints under `/api/v1/itsm/`.

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets` | Create ticket (manual) |
| GET | `/tickets` | List tickets (with pagination, filters) |
| GET | `/tickets/:id` | Get ticket detail (includes linked alert, asset, RCA) |
| PATCH | `/tickets/:id/status` | Transition status (enforces state machine) |
| PATCH | `/tickets/:id/assign` | Assign to operator |
| POST | `/tickets/:id/comments` | Add comment |
| GET | `/tickets/:id/comments` | List comments |
| GET | `/tickets/:id/history` | Get audit trail |
| POST | `/tickets/:id/links` | Link to another ticket |

### SLA
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sla/policies` | List SLA policies |
| POST | `/sla/policies` | Create SLA policy (admin) |
| GET | `/sla/dashboard` | SLA compliance stats and KPIs |
| GET | `/sla/breaches` | Active breached tickets |

### Problems & Changes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/problems` | Create problem record |
| GET | `/problems` | List problems |
| POST | `/changes` | Create change request |
| GET | `/changes` | List changes |
| GET | `/changes/calendar` | Change calendar view |

### Knowledge Base
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/kb/articles` | Create article |
| GET | `/kb/articles` | List/search articles |
| GET | `/kb/articles/:id` | Get article |
| GET | `/kb/suggest?query=` | Auto-suggest articles for ticket context |

### Query Parameters (standard across list endpoints)
- `page` (default: 1), `limit` (default: 20, max: 100)
- `sort` (e.g., `created_at:desc`)
- `status`, `severity`, `priority`, `type`, `assigned_to` (filters)
- `search` (full-text search on title + description)
- `sla_breach=true` (filter breached tickets)

---

## 10. NestJS Module Structure

```
apps/itsm/
├── src/
│   ├── main.ts                     # Bootstrap, port 3005
│   ├── app.module.ts               # Root module
│   ├── config/
│   │   └── itsm.config.ts          # Environment config
│   ├── tickets/
│   │   ├── tickets.module.ts
│   │   ├── tickets.controller.ts
│   │   ├── tickets.service.ts
│   │   ├── tickets.repository.ts
│   │   ├── dto/
│   │   │   ├── create-ticket.dto.ts
│   │   │   ├── update-status.dto.ts
│   │   │   └── ticket-query.dto.ts
│   │   └── entities/
│   │       └── ticket.entity.ts
│   ├── comments/
│   │   ├── comments.module.ts
│   │   ├── comments.controller.ts
│   │   └── comments.service.ts
│   ├── sla/
│   │   ├── sla.module.ts
│   │   ├── sla.service.ts          # SLA calculation logic
│   │   ├── sla-engine.service.ts   # Cron job — breach detection + escalation
│   │   └── sla.controller.ts       # Dashboard / KPI endpoints
│   ├── problems/
│   │   ├── problems.module.ts
│   │   ├── problems.controller.ts
│   │   └── problems.service.ts
│   ├── changes/
│   │   ├── changes.module.ts
│   │   ├── changes.controller.ts
│   │   └── changes.service.ts
│   ├── kb/
│   │   ├── kb.module.ts
│   │   ├── kb.controller.ts
│   │   └── kb.service.ts
│   ├── events/
│   │   ├── redis-consumer.service.ts  # Consumes alert stream
│   │   └── redis-publisher.service.ts # Publishes ITSM events
│   ├── integrations/
│   │   ├── ems-core.client.ts         # HTTP client for EMS Core API
│   │   └── ems-core.module.ts
│   ├── common/
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts      # Validates JWT from EMS Core
│   │   ├── interceptors/
│   │   │   └── audit.interceptor.ts   # Auto-records ticket_history
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── utils/
│   │       └── ticket-number.generator.ts  # e.g., INC-20260215-0001
│   └── database/
│       ├── migrations/
│       └── seeds/
│           └── sla-policies.seed.ts   # Default SLA policies
├── test/
│   ├── tickets.e2e-spec.ts
│   ├── sla-engine.spec.ts
│   └── redis-consumer.spec.ts
├── Dockerfile
└── tsconfig.json
```

---

## 11. Ticket Number Format

Generate sequential, human-readable ticket numbers:
- **Incidents:** `INC-YYYYMMDD-NNNN` (e.g., `INC-20260215-0001`)
- **Problems:** `PRB-YYYYMMDD-NNNN`
- **Changes:** `CHG-YYYYMMDD-NNNN`

Use a PostgreSQL sequence or a counter in Redis for the daily `NNNN` portion.

---

## 12. Build Order (Follow This Sequence)

### Phase 1 — MVP (Build in this order)
1. **Module scaffold** — NestJS app, Docker config, health endpoint
2. **Database migrations** — All tables with indexes + seed SLA policies
3. **Ticket CRUD** — Create, read, update with status state machine enforcement
4. **Ticket number generator** — INC/PRB/CHG prefix + daily sequence
5. **Comments service** — Add/list with public/internal visibility
6. **Audit interceptor** — Auto-record all ticket field changes to ticket_history
7. **SLA service** — Calculate `sla_due_at` on ticket creation, pause on pending
8. **SLA engine cron** — Breach detection + escalation event publishing
9. **Redis consumer** — Listen to `ems:alerts:stream`, auto-create tickets with dedup
10. **Redis publisher** — Publish ITSM lifecycle events
11. **EMS Core client** — HTTP integration for assets, alerts, users
12. **REST API controllers** — All ticket/SLA/KB endpoints with validation + pagination
13. **Integration tests** — Alert → auto-ticket → SLA countdown → breach flow

### Phase 2 — Extend
14. Problem management (link incidents, known error DB)
15. Change management (approval workflow, calendar)
16. Knowledge base (CRUD + auto-suggest)
17. SLA dashboard KPIs (MTTR, MTTA, compliance %)
18. Frontend integration (React components)

### Phase 3 — Scale
19. Multi-tenancy support
20. Customer portal
21. Email-to-ticket ingestion
22. Chat integrations

---

## 13. Docker Configuration

Add to the project root `docker-compose.yml`:

```yaml
itsm-module:
  build:
    context: .
    dockerfile: apps/itsm/Dockerfile
  ports:
    - "3005:3005"
  environment:
    - NODE_ENV=development
    - PORT=3005
    - DATABASE_URL=postgresql://ems:ems_password@postgres:5432/ems_platform
    - REDIS_URL=redis://redis:6379
    - EMS_CORE_URL=http://ems-core:3000/api/v1
    - ITSM_MODULE_API_KEY=${ITSM_MODULE_API_KEY}
    - JWT_SECRET=${JWT_SECRET}
  depends_on:
    - postgres
    - redis
    - ems-core
```

---

## 14. Coding Standards & Conventions

- **Language:** TypeScript (strict mode)
- **Style:** Follow existing EMS platform conventions
- **DTOs:** Use `class-validator` decorators for all inputs
- **Responses:** Wrap in consistent `{ data, meta, error }` envelope
- **Errors:** Use NestJS built-in `HttpException` classes
- **Logging:** Use NestJS `Logger` — structured JSON in production
- **Tests:** Unit tests for services, e2e for API endpoints
- **Naming:** camelCase for code, snake_case for database columns
- **UUIDs everywhere:** Never use auto-increment integer IDs
- **Timestamps:** Always `TIMESTAMP WITH TIME ZONE`, stored as UTC

---

## 15. User Stories (Reference)

| Persona | Story |
|---------|-------|
| NOC Operator | Critical alert fires → ticket auto-created → I see it in my queue with SLA countdown |
| NOC Operator | I create a manual ticket for a reported issue, attach it to an asset |
| Service Manager | I view SLA dashboard — see breach risks, MTTR trends, compliance % |
| Engineer | I open a ticket and see linked alert details, asset info, ML root cause analysis |
| Admin | I configure SLA policies per severity and set escalation matrix |

---

## 16. Integration Testing Scenarios

These are the critical end-to-end flows to validate:

1. **Alert → Auto-Ticket:** Publish critical alert to Redis → ITSM creates ticket → ticket has correct alert_id, severity, SLA
2. **Dedup:** Publish same alert twice → only one ticket created
3. **SLA Breach:** Create ticket with 1-minute SLA → wait → verify `breached = TRUE` and escalation event published
4. **Status Transitions:** Attempt invalid transition (e.g., `open` → `closed`) → verify rejection
5. **Pending Pauses SLA:** Move ticket to `pending` → verify SLA clock paused → resume → verify clock resumes
6. **Ticket Resolve → Alert Update:** Resolve ticket → verify EMS Core alert status updated via API
7. **Audit Trail:** Change any ticket field → verify `ticket_history` record created

---

## 17. Things to Watch Out For

- **Cross-service references are NOT foreign keys.** `asset_id`, `alert_id`, `assigned_to`, `created_by` in the tickets table reference EMS Core entities. Do not create FK constraints for these — validate via API calls instead.
- **SLA time calculation must exclude `pending` duration.** Track cumulative pending time, don't just use `created_at` vs `now()`.
- **Redis consumer must handle restart gracefully.** Use consumer groups with acknowledgment — unacknowledged messages will be redelivered.
- **Ticket number generation must be concurrency-safe.** Use a PostgreSQL sequence or Redis `INCR` — do not generate in application memory.
- **Always validate JWT tokens** from EMS Core on every request. ITSM does not issue its own tokens.
- **All list endpoints must be paginated.** Never return unbounded result sets.
