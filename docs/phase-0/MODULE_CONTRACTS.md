# Module Contracts - API Specifications

**Status:** ✅ LOCKED - All modules MUST follow these contracts  
**Date:** January 8, 2026  
**Author:** Pramod + Claude

---

## Overview

Every module exposes a REST API and publishes events. These are the contracts that ensure modules can communicate without direct dependencies.

---

## EMS Core API

**Base URL:** `http://localhost:3000/api/v1`

### Assets
```typescript
// Create Asset
POST /assets
Body: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
Response: Asset

// Get Assets (with filtering)
GET /assets?type=router&status=online&limit=50&offset=0
Response: { data: Asset[], total: number, page: number }

// Get Single Asset
GET /assets/:id
Response: Asset

// Update Asset
PATCH /assets/:id
Body: Partial<Asset>
Response: Asset

// Delete Asset
DELETE /assets/:id
Response: { success: boolean }

// Bulk Import
POST /assets/bulk
Body: { assets: Asset[] }
Response: { created: number, failed: number, errors: string[] }
```

### Events
```typescript
// Create Event
POST /events
Body: Omit<Event, 'id' | 'firstOccurrence' | 'lastOccurrence' | 'occurrenceCount'>
Response: Event

// Get Events (with filters)
GET /events?source=nms&severity=critical&since=2026-01-01T00:00:00Z
Response: { data: Event[], total: number }

// Get Single Event
GET /events/:id
Response: Event
```

### Alerts
```typescript
// Get Alerts (filterable)
GET /alerts?status=open&sortBy=businessImpactScore&order=desc
Response: { data: Alert[], total: number }

// Get Single Alert
GET /alerts/:id
Response: Alert

// Acknowledge Alert
POST /alerts/:id/acknowledge
Body: { acknowledgedBy: string, notes?: string }
Response: Alert

// Resolve Alert
POST /alerts/:id/resolve
Body: { resolvedBy: string, notes: string, resolutionCategory: string }
Response: Alert

// Close Alert
POST /alerts/:id/close
Body: { closedBy: string, notes?: string }
Response: Alert
```

### Metrics
```typescript
// Submit Metric (single)
POST /metrics
Body: Omit<Metric, 'id'>
Response: Metric

// Submit Metrics (batch)
POST /metrics/batch
Body: { metrics: Metric[] }
Response: { accepted: number, rejected: number }

// Query Metrics
GET /metrics?assetId=xxx&metricName=cpu_usage&from=timestamp&to=timestamp&aggregation=avg
Response: { data: Array<{ timestamp: Date, value: number }> }
```

---

## NMS Module API

**Base URL:** `http://localhost:3001/api/v1`

### Device Discovery
```typescript
// Discover Devices (SNMP scan)
POST /nms/discover
Body: { 
  ipRange: string,        // e.g., "192.168.1.0/24"
  community?: string      // SNMP community string
}
Response: { 
  discovered: Asset[], 
  failed: string[] 
}

// Poll Device Now
POST /nms/devices/:id/poll
Response: { 
  success: boolean, 
  metrics: Metric[] 
}
```

### Events Published by NMS
```typescript
// Device Down
{
  type: 'device.down',
  payload: {
    assetId: string,
    lastSeen: Date,
    pollingAttempts: number
  }
}

// Device Up
{
  type: 'device.up',
  payload: {
    assetId: string,
    downtime: number  // seconds
  }
}

// Threshold Breached
{
  type: 'threshold.breached',
  payload: {
    assetId: string,
    metricName: string,
    value: number,
    threshold: number,
    operator: string  // '>', '<', '==', etc.
  }
}
```

---

## Cloud Monitoring Module API

**Base URL:** `http://localhost:3002/api/v1`

### AWS Discovery
```typescript
// Discover AWS Resources
POST /cloud/aws/discover
Body: { 
  region: string,         // e.g., "us-east-1"
  credentials: {
    accessKeyId: string,
    secretAccessKey: string
  }
}
Response: { 
  ec2Instances: Asset[],
  rdsInstances: Asset[],
  lambdaFunctions: Asset[]
}

// Get CloudWatch Metrics
GET /cloud/aws/metrics/:resourceId?metric=CPUUtilization&period=300
Response: { data: Metric[] }
```

### Events Published by Cloud Module
```typescript
// Instance State Change
{
  type: 'cloud.instance.state_change',
  payload: {
    assetId: string,
    previousState: string,
    currentState: string,  // running, stopped, terminated
    provider: 'aws'
  }
}

// Cost Alert
{
  type: 'cloud.cost.threshold',
  payload: {
    region: string,
    currentCost: number,
    threshold: number,
    period: string
  }
}
```

---

## AI/ML Correlation Engine API

**Base URL:** `http://localhost:3003/api/v1`

### Correlation
```typescript
// Predict Root Cause
POST /ml/predict-root-cause
Body: {
  alertId: string,
  recentEvents: Event[],    // Last 1 hour of events
  affectedAssets: Asset[]
}
Response: {
  rootCauseAssetId: string,
  confidence: number,        // 0-1
  reasoning: string[],       // Explainable AI
  alternativeHypotheses: Array<{
    assetId: string,
    confidence: number
  }>
}

// Calculate Business Impact
POST /ml/calculate-impact
Body: {
  alertId: string,
  affectedAssets: Asset[],
  businessServices: BusinessService[]
}
Response: {
  impactScore: number,       // 0-100
  affectedServices: string[],
  estimatedUsers: number,
  revenueAtRisk: number,
  breakdown: {
    serviceCriticality: number,
    userImpact: number,
    slaRisk: number,
    revenueImpact: number
  }
}

// Cluster Alerts
POST /ml/cluster-alerts
Body: {
  alerts: Alert[],
  timeWindow: number         // seconds
}
Response: {
  clusters: Array<{
    clusterId: string,
    alertIds: string[],
    primaryAlertId: string,   // Most severe/impactful
    suppressedAlertIds: string[]
  }>
}

// Train Model (triggered manually or scheduled)
POST /ml/train
Body: {
  startDate: Date,
  endDate: Date,
  modelType: 'rca' | 'clustering'
}
Response: {
  modelVersion: string,
  accuracy: number,
  precision: number,
  recall: number,
  f1Score: number
}
```

### Events Published by ML Module
```typescript
// Root Cause Identified
{
  type: 'ml.root_cause.identified',
  payload: {
    alertId: string,
    rootCauseAssetId: string,
    confidence: number
  }
}

// Pattern Detected
{
  type: 'ml.pattern.detected',
  payload: {
    patternType: string,
    frequency: number,
    affectedAssets: string[]
  }
}
```

---

## APM Module API

**Base URL:** `http://localhost:3004/api/v1`

### Applications
```typescript
// Register Application
POST /apm/applications
Body: {
  name: string,
  url: string,
  healthCheckEndpoint: string,
  tier: ServiceTier
}
Response: Asset  // Application is an Asset

// Submit Transaction
POST /apm/transactions
Body: Omit<Transaction, 'id'>
Response: Transaction

// Submit Trace
POST /apm/traces
Body: Omit<Trace, 'id'>
Response: Trace

// Get Application Health
GET /apm/applications/:id/health
Response: {
  status: 'healthy' | 'degraded' | 'down',
  uptime: number,           // percentage
  avgResponseTime: number,  // ms (last hour)
  errorRate: number,        // percentage
  throughput: number        // req/s
}

// Get Dependency Map
GET /apm/applications/:id/dependencies
Response: {
  nodes: Array<{ id: string, name: string, type: string }>,
  edges: Array<{ 
    source: string, 
    target: string, 
    callCount: number,
    avgLatency: number 
  }>
}
```

### Events Published by APM Module
```typescript
// Application Down
{
  type: 'apm.application.down',
  payload: {
    applicationId: string,
    lastSuccessfulCheck: Date,
    failureReason: string
  }
}

// Slow Response Time
{
  type: 'apm.performance.slow',
  payload: {
    applicationId: string,
    endpoint: string,
    avgResponseTime: number,
    threshold: number
  }
}

// High Error Rate
{
  type: 'apm.error_rate.high',
  payload: {
    applicationId: string,
    errorRate: number,      // percentage
    threshold: number,
    errorTypes: string[]
  }
}
```

---

## ITSM Module API

**Base URL:** `http://localhost:3005/api/v1`

### Tickets
```typescript
// Create Ticket
POST /itsm/tickets
Body: {
  title: string,
  description: string,
  linkedAlertId?: string,
  priority: 'low' | 'medium' | 'high' | 'critical',
  assignee?: string,
  team?: string,
  slaHours?: number
}
Response: Ticket

// Get Tickets (filterable)
GET /itsm/tickets?status=open&priority=critical&assignee=pramod
Response: { data: Ticket[], total: number }

// Update Ticket
PATCH /itsm/tickets/:id
Body: Partial<Ticket>
Response: Ticket

// Add Comment
POST /itsm/tickets/:id/comments
Body: { author: string, text: string }
Response: Comment

// Auto-Create from Alert
POST /itsm/tickets/from-alert/:alertId
Response: Ticket
```

---

## Event Bus (Redis Streams)

All modules publish events to Redis Streams for loose coupling.

### Stream Names
```
ems:events:nms          // NMS events
ems:events:cloud        // Cloud events
ems:events:apm          // APM events
ems:events:ml           // ML insights
ems:events:itsm         // ITSM updates
```

### Event Format
```typescript
interface BusEvent {
  id: string,              // UUID
  type: string,            // Event type (e.g., 'device.down')
  source: string,          // Module name
  timestamp: Date,
  payload: Record<string, any>,
  correlationId?: string
}
```

### Publishing (Node.js example)
```typescript
await redis.xadd(
  'ems:events:nms',
  '*',  // Auto-generate ID
  'data', JSON.stringify(event)
);
```

### Consuming (Consumer Groups)
```typescript
// Each module creates a consumer group
await redis.xgroup(
  'CREATE', 
  'ems:events:nms', 
  'alert-processor', 
  '0', 
  'MKSTREAM'
);

// Read events
const events = await redis.xreadgroup(
  'GROUP', 'alert-processor', 'consumer-1',
  'COUNT', 10,
  'BLOCK', 1000,
  'STREAMS', 'ems:events:nms', '>'
);
```

---

## Authentication & Authorization

### API Authentication

All API calls require Bearer token:
```
Authorization: Bearer <JWT_TOKEN>
```

### JWT Token Structure
```typescript
interface JWTPayload {
  userId: string,
  username: string,
  role: 'admin' | 'operator' | 'viewer',
  permissions: string[],
  exp: number  // Unix timestamp
}
```

### RBAC Permissions
```typescript
// Admin - Full access
permissions: ['*']

// Operator - Read + Write operational data
permissions: [
  'assets:read', 'assets:write',
  'alerts:read', 'alerts:write',
  'tickets:read', 'tickets:write'
]

// Viewer - Read-only
permissions: [
  'assets:read',
  'alerts:read',
  'tickets:read'
]
```

---

## Error Handling

All APIs return consistent error format:
```typescript
interface ErrorResponse {
  success: false,
  error: {
    code: string,           // e.g., "ASSET_NOT_FOUND"
    message: string,        // Human-readable
    details?: any,          // Additional context
    timestamp: Date
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input (400)
- `UNAUTHORIZED` - Auth required (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `NOT_FOUND` - Resource doesn't exist (404)
- `CONFLICT` - Duplicate or constraint violation (409)
- `RATE_LIMIT_EXCEEDED` - Too many requests (429)
- `INTERNAL_ERROR` - Server error (500)

---

## Rate Limiting
```
100 requests/minute per API key
Burst: 20 requests/second
```

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704729600
```

---

## Health Checks

All modules expose:
```
GET /health
Response: {
  status: 'healthy' | 'degraded' | 'unhealthy',
  version: string,
  uptime: number,  // seconds
  dependencies: {
    postgres: 'healthy' | 'unhealthy',
    redis: 'healthy' | 'unhealthy'
  }
}
```

---

## ⚠️ CONTRACT RULES

1. **Breaking changes forbidden** - Only add, never remove/rename
2. **Versioning required** - `/api/v1`, `/api/v2` for major changes
3. **Backward compatibility** - Old versions supported for 6 months
4. **Documentation first** - Update this doc before implementing
5. **OpenAPI specs** - Generate from this document

---

**Approved by:** Pramod  
**Date:** January 8, 2026  
**Status:** LOCKED ✅