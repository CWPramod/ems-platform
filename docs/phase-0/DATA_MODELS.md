# Canonical Data Models

**Status:** ✅ LOCKED - Foundation of entire platform  
**Date:** January 8, 2026  
**Author:** Pramod + Claude

---

## Overview

These 7 data models are the **single source of truth** for the EMS platform. Every module MUST use these exact structures. No custom fields without updating this document.

---

## 1. Asset Model

**Purpose:** Single source of truth for all IT assets (network devices, servers, cloud VMs, applications)

### Schema
```typescript
interface Asset {
  // Identity
  id: string;                    // UUID
  name: string;                  // Display name (e.g., "Core-Router-1")
  type: AssetType;               // Enum: see below
  
  // Location
  ip: string;                    // Primary IP address
  location: string;              // Physical/logical location
  region?: string;               // For cloud assets (e.g., "us-east-1")
  
  // Classification
  vendor: string;                // Manufacturer/provider
  model?: string;                // Device/instance model
  tags: string[];                // Custom tags for organization
  tier: ServiceTier;             // Business criticality (1-3)
  
  // Ownership
  owner: string;                 // Team/person responsible
  department?: string;           // Business unit
  
  // Status
  status: AssetStatus;           // Current operational status
  monitoringEnabled: boolean;    // Is it being monitored?
  
  // Metadata
  metadata: Record<string, any>; // Flexible JSON for asset-specific data
  createdAt: Date;
  updatedAt: Date;
}

enum AssetType {
  // Network
  ROUTER = 'router',
  SWITCH = 'switch',
  FIREWALL = 'firewall',
  LOAD_BALANCER = 'load_balancer',
  
  // Compute
  SERVER = 'server',
  VM = 'vm',
  CONTAINER = 'container',
  
  // Cloud
  EC2 = 'ec2',
  RDS = 'rds',
  LAMBDA = 'lambda',
  
  // Application
  APPLICATION = 'application',
  DATABASE = 'database',
  API = 'api'
}

enum AssetStatus {
  ONLINE = 'online',
  WARNING = 'warning',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown'
}

enum ServiceTier {
  CRITICAL = 1,    // Revenue-impacting, must have 24/7 support
  IMPORTANT = 2,   // Business operations, office hours support
  STANDARD = 3     // Non-critical, best effort
}
```

### Example
```json
{
  "id": "ast_7f8a9b2c-3d4e-5f6g-7h8i-9j0k1l2m3n4o",
  "name": "Payment-API-Server",
  "type": "application",
  "ip": "10.0.5.42",
  "location": "Data Center 1 - Rack A3",
  "vendor": "Custom",
  "tags": ["payment", "production", "pci-compliant"],
  "tier": 1,
  "owner": "payments-team",
  "department": "Engineering",
  "status": "online",
  "monitoringEnabled": true,
  "metadata": {
    "appVersion": "2.5.3",
    "framework": "Node.js",
    "revenue_per_hour": 50000
  },
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-08T12:00:00Z"
}
```

---

## 2. Metric Model

**Purpose:** Time-series performance data from all sources

### Schema
```typescript
interface Metric {
  // Identity
  id: string;                    // UUID
  assetId: string;               // FK to Asset
  
  // Metric Details
  metricName: string;            // e.g., "cpu_usage", "response_time"
  value: number;                 // Numeric value
  unit: string;                  // %, ms, Mbps, KB, etc.
  
  // Context
  source: MetricSource;          // Where it came from
  tags?: Record<string, string>; // Additional dimensions
  
  // Timing
  timestamp: Date;               // When metric was collected
  
  // Aggregation (if pre-aggregated)
  aggregationType?: AggregationType;
  aggregationWindow?: number;    // Seconds
}

enum MetricSource {
  NMS = 'nms',
  CLOUD = 'cloud',
  APM = 'apm',
  SERVER = 'server'
}

enum AggregationType {
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  P50 = 'p50',
  P95 = 'p95',
  P99 = 'p99'
}
```

### Common Metric Names

**Network:**
- `bandwidth_in` (Mbps)
- `bandwidth_out` (Mbps)
- `packet_loss` (%)
- `latency` (ms)
- `jitter` (ms)

**Server:**
- `cpu_usage` (%)
- `memory_usage` (%)
- `disk_usage` (%)
- `disk_io_read` (KB/s)
- `disk_io_write` (KB/s)

**Application:**
- `response_time` (ms)
- `error_rate` (%)
- `throughput` (req/s)
- `active_connections` (count)

---

## 3. Event Model

**Purpose:** Normalized events from all monitoring sources

### Schema
```typescript
interface Event {
  // Identity
  id: string;                    // UUID
  fingerprint: string;           // Hash for deduplication
  
  // Source
  source: EventSource;           // Which module generated it
  assetId?: string;              // FK to Asset (if asset-related)
  
  // Classification
  severity: EventSeverity;
  category: string;              // e.g., "network", "security", "performance"
  
  // Content
  title: string;                 // Short summary
  message: string;               // Detailed description
  
  // Context
  metadata: Record<string, any>; // Source-specific data
  affectedServices?: string[];   // Business services impacted
  
  // Correlation
  correlationId?: string;        // Group related events
  parentEventId?: string;        // For event chains
  
  // Timing
  timestamp: Date;
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;       // How many times it happened
}

enum EventSource {
  NMS = 'nms',
  CLOUD = 'cloud',
  APM = 'apm',
  SERVER = 'server',
  SIEM = 'siem',
  ITSM = 'itsm'
}

enum EventSeverity {
  CRITICAL = 'critical',    // Immediate action required
  WARNING = 'warning',      // Attention needed soon
  INFO = 'info'             // Informational only
}
```

### Fingerprint Generation
```typescript
// Fingerprint = hash of key attributes for deduplication
fingerprint = hash(source + assetId + category + title)
```

---

## 4. Alert Model

**Purpose:** Actionable alerts with lifecycle management

### Schema
```typescript
interface Alert {
  // Identity
  id: string;                    // UUID
  eventId: string;               // FK to Event
  
  // Status Tracking
  status: AlertStatus;
  
  // Assignment
  owner?: string;                // Assigned to
  team?: string;                 // Team responsible
  
  // AI/ML Enrichment
  rootCauseAssetId?: string;     // AI-predicted root cause
  rootCauseConfidence?: number;  // 0-1 confidence score
  businessImpactScore: number;   // Calculated by AI (0-100)
  affectedUsers?: number;        // Estimated user impact
  revenueAtRisk?: number;        // Estimated $/hour
  
  // Related Alerts
  correlatedAlertIds?: string[]; // Grouped alerts
  suppressedBy?: string;         // If suppressed by another alert
  
  // SLA
  slaDeadline?: Date;            // Must respond by
  slaBreached: boolean;
  
  // Lifecycle Timestamps
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  closedAt?: Date;
  closedBy?: string;
  
  // Resolution
  resolutionNotes?: string;
  resolutionCategory?: string;   // For ML training
}

enum AlertStatus {
  OPEN = 'open',                 // New, needs attention
  ACKNOWLEDGED = 'acknowledged', // Someone is working on it
  RESOLVED = 'resolved',         // Issue fixed, monitoring
  CLOSED = 'closed'              // Confirmed resolved
}
```

---

## 5. Transaction Model (APM)

**Purpose:** Application request/response tracking

### Schema
```typescript
interface Transaction {
  // Identity
  id: string;                    // UUID
  traceId: string;               // Distributed trace ID
  spanId: string;                // OpenTelemetry span ID
  
  // Application
  applicationId: string;         // FK to Asset
  endpoint: string;              // URL/route
  method: string;                // HTTP method or function name
  
  // Performance
  startTime: Date;
  duration: number;              // Milliseconds
  statusCode?: number;           // HTTP status code
  
  // Result
  success: boolean;
  error?: string;                // Error message if failed
  errorType?: string;            // Error category
  
  // Context
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  
  // Dependencies
  externalCalls?: ExternalCall[];
}

interface ExternalCall {
  service: string;
  duration: number;
  success: boolean;
}
```

---

## 6. Trace Model (APM)

**Purpose:** Distributed trace spans for dependency mapping

### Schema
```typescript
interface Trace {
  // Identity
  traceId: string;               // Distributed trace ID
  spanId: string;
  parentSpanId?: string;
  
  // Service
  serviceName: string;
  operationName: string;
  
  // Timing
  startTime: Date;
  duration: number;              // Microseconds
  
  // Attributes
  tags: Record<string, string>;
  logs?: TraceLog[];
  
  // Status
  statusCode: string;
  error?: boolean;
}

interface TraceLog {
  timestamp: Date;
  message: string;
  level: string;
}
```

---

## 7. BusinessService Model

**Purpose:** Business service definitions for impact calculation

### Schema
```typescript
interface BusinessService {
  // Identity
  id: string;                    // UUID
  name: string;                  // e.g., "Payment Processing"
  
  // Classification
  tier: ServiceTier;             // Business criticality
  department: string;
  
  // Dependencies
  dependsOnAssets: string[];     // Asset IDs this service needs
  dependsOnServices: string[];   // Other services it needs
  
  // Business Metrics
  averageRevenuePerHour: number; // For impact calculation
  activeUsers: number;           // Current user count
  
  // SLA
  slaTargetUptime: number;       // Percentage (e.g., 99.9)
  slaTargetResponseTime: number; // Milliseconds
  
  // Status
  currentStatus: ServiceStatus;
  lastIncident?: Date;
  
  // Metadata
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DOWN = 'down'
}
```

---

## Relationships
```
Asset 1:N Metric
Asset 1:N Event
Event 1:1 Alert
Asset 1:N Transaction
Transaction N:M Trace (via traceId)
BusinessService N:M Asset
Alert N:1 BusinessService (calculated)
```

---

## Database Indexes (PostgreSQL)
```sql
-- Assets
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_tier ON assets(tier);

-- Metrics (TimescaleDB hypertable)
CREATE INDEX idx_metrics_asset_time ON metrics(asset_id, timestamp DESC);
CREATE INDEX idx_metrics_name_time ON metrics(metric_name, timestamp DESC);

-- Events
CREATE INDEX idx_events_fingerprint ON events(fingerprint);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_source_severity ON events(source, severity);

-- Alerts
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_impact ON alerts(business_impact_score DESC);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- Transactions
CREATE INDEX idx_transactions_trace ON transactions(trace_id);
CREATE INDEX idx_transactions_app_time ON transactions(application_id, start_time DESC);
```

---

## ⚠️ CRITICAL RULES

1. **No custom fields without approval** - Extend metadata JSON instead
2. **All timestamps in UTC** - Convert on display only
3. **IDs are UUIDs** - Use v4, no sequential integers
4. **Enums are strings** - Not numeric codes
5. **JSON metadata** - Use for flexibility, but don't abuse

---

**Approved by:** Pramod  
**Date:** January 8, 2026  
**Status:** LOCKED ✅