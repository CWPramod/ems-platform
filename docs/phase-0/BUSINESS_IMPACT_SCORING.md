# Business Impact Scoring Formula

**Status:** ✅ LOCKED - Core differentiation from competitors  
**Date:** January 8, 2026  
**Author:** Pramod + Claude

---

## Vision

**Every alert shows business impact, not just technical severity.**

When a database server fails, operators immediately see:
- 💰 "$50,000/hour revenue at risk"
- 👥 "10,000 users affected"
- 📊 "3 critical services down"
- ⏰ "SLA breach in 15 minutes"

This transforms IT from "reactive firefighting" to "business-driven operations."

---

## The Formula
```
Business Impact Score = (SC × UA × SR × RI) / 100

Where:
SC = Service Criticality     (0-10)
UA = Users Affected          (0-10)
SR = SLA Risk               (0-10)
RI = Revenue Impact         (0-10)

Final Score: 0-100 (normalized)
```

### Score Interpretation
```
90-100  🔴 CATASTROPHIC   CEO-level incident, all hands on deck
70-89   🟠 CRITICAL       Major business disruption
50-69   🟡 SIGNIFICANT    Noticeable impact, urgent action
30-49   🟢 MODERATE       Limited impact, standard priority
0-29    🔵 MINOR          Minimal business effect
```

---

## Component 1: Service Criticality (SC)

**Definition:** How critical is the affected service to business operations?

### Calculation
```typescript
function calculateServiceCriticality(asset: Asset): number {
  const tier = asset.tier;  // 1=Critical, 2=Important, 3=Standard
  
  // Base score from tier
  let score = 0;
  if (tier === 1) score = 10;      // Critical
  else if (tier === 2) score = 6;  // Important
  else score = 3;                  // Standard
  
  // Boost for revenue-generating services
  if (asset.metadata.revenue_generating === true) {
    score = Math.min(10, score + 2);
  }
  
  // Boost for compliance-critical (PCI, HIPAA, etc.)
  if (asset.metadata.compliance_critical === true) {
    score = Math.min(10, score + 1);
  }
  
  return score;
}
```

### Examples

| Asset | Tier | Revenue Gen | Compliance | Score |
|-------|------|-------------|------------|-------|
| Payment API | 1 | Yes | PCI-DSS | 10 |
| Core Database | 1 | Yes | No | 10 |
| Email Server | 2 | No | No | 6 |
| Dev Server | 3 | No | No | 3 |
| Monitoring System | 2 | No | No | 6 |

---

## Component 2: Users Affected (UA)

**Definition:** How many users/customers are impacted by this issue?

### Calculation
```typescript
function calculateUsersAffected(
  asset: Asset, 
  businessServices: BusinessService[]
): number {
  // Find all business services that depend on this asset
  const affectedServices = businessServices.filter(
    service => service.dependsOnAssets.includes(asset.id)
  );
  
  // Sum up active users across affected services
  const totalUsers = affectedServices.reduce(
    (sum, service) => sum + service.activeUsers, 
    0
  );
  
  // Map to 0-10 scale (logarithmic)
  if (totalUsers >= 100000) return 10;      // 100K+
  if (totalUsers >= 50000) return 9;        // 50K-100K
  if (totalUsers >= 10000) return 8;        // 10K-50K
  if (totalUsers >= 5000) return 7;         // 5K-10K
  if (totalUsers >= 1000) return 6;         // 1K-5K
  if (totalUsers >= 500) return 5;          // 500-1K
  if (totalUsers >= 100) return 4;          // 100-500
  if (totalUsers >= 50) return 3;           // 50-100
  if (totalUsers >= 10) return 2;           // 10-50
  if (totalUsers > 0) return 1;             // 1-10
  return 0;                                 // None
}
```

### Example Mapping

| Users Affected | Score | Example |
|----------------|-------|---------|
| 500,000+ | 10 | National e-commerce site down |
| 100,000 | 10 | Mobile app login broken |
| 50,000 | 9 | Payment gateway slow |
| 10,000 | 8 | Regional service outage |
| 5,000 | 7 | Single product line affected |
| 1,000 | 6 | Corporate VPN down |
| 500 | 5 | Department-wide issue |
| 100 | 4 | Team collaboration tool |
| 10 | 2 | Individual dev environment |
| 0 | 0 | Internal monitoring only |

---

## Component 3: SLA Risk (SR)

**Definition:** How close are we to breaching our Service Level Agreement?

### Calculation
```typescript
function calculateSLARisk(
  alert: Alert,
  businessServices: BusinessService[]
): number {
  const affectedServices = getAffectedServices(alert, businessServices);
  
  // Find most at-risk service
  let maxRisk = 0;
  
  for (const service of affectedServices) {
    const slaDeadline = calculateSLADeadline(service, alert.createdAt);
    const timeRemaining = slaDeadline.getTime() - Date.now();
    const timeRemainingMinutes = timeRemaining / (1000 * 60);
    
    // Calculate risk based on time remaining
    let risk = 0;
    if (timeRemainingMinutes <= 0) risk = 10;       // Already breached
    else if (timeRemainingMinutes <= 15) risk = 9;  // <15 min
    else if (timeRemainingMinutes <= 30) risk = 8;  // <30 min
    else if (timeRemainingMinutes <= 60) risk = 7;  // <1 hour
    else if (timeRemainingMinutes <= 120) risk = 6; // <2 hours
    else if (timeRemainingMinutes <= 240) risk = 5; // <4 hours
    else if (timeRemainingMinutes <= 480) risk = 4; // <8 hours
    else risk = 2;                                  // >8 hours
    
    maxRisk = Math.max(maxRisk, risk);
  }
  
  return maxRisk;
}
```

### SLA Response Time Matrix

| Severity | Tier 1 (Critical) | Tier 2 (Important) | Tier 3 (Standard) |
|----------|-------------------|-------------------|-------------------|
| Critical | 15 min | 30 min | 1 hour |
| Warning | 1 hour | 4 hours | 8 hours |
| Info | 8 hours | 24 hours | 72 hours |

### Example
```
Alert: Database server down
Severity: Critical
Service Tier: 1 (Critical)
SLA Response: 15 minutes

Timeline:
- 0 min: Alert created → SR = 2 (safe)
- 10 min: No response → SR = 9 (urgent!)
- 15 min: Breached → SR = 10 (catastrophic)
```

---

## Component 4: Revenue Impact (RI)

**Definition:** How much money is at risk per hour?

### Calculation
```typescript
function calculateRevenueImpact(
  asset: Asset,
  businessServices: BusinessService[]
): number {
  const affectedServices = getAffectedServices(asset, businessServices);
  
  // Sum revenue at risk
  const totalRevenuePerHour = affectedServices.reduce(
    (sum, service) => sum + (service.averageRevenuePerHour || 0),
    0
  );
  
  // Map to 0-10 scale (logarithmic)
  if (totalRevenuePerHour >= 100000) return 10;  // $100K+/hour
  if (totalRevenuePerHour >= 50000) return 9;    // $50K-100K
  if (totalRevenuePerHour >= 25000) return 8;    // $25K-50K
  if (totalRevenuePerHour >= 10000) return 7;    // $10K-25K
  if (totalRevenuePerHour >= 5000) return 6;     // $5K-10K
  if (totalRevenuePerHour >= 2500) return 5;     // $2.5K-5K
  if (totalRevenuePerHour >= 1000) return 4;     // $1K-2.5K
  if (totalRevenuePerHour >= 500) return 3;      // $500-1K
  if (totalRevenuePerHour >= 100) return 2;      // $100-500
  if (totalRevenuePerHour > 0) return 1;         // <$100
  return 0;                                      // No direct revenue
}
```

### Revenue Estimation Methods

**Method 1: Direct (E-commerce)**
```
Revenue/Hour = (Total Annual Revenue / 8760 hours) × Service %
Example: $50M annual → $5,700/hour → If service handles 10% → $570/hour
```

**Method 2: Transaction-Based (Payment Processing)**
```
Revenue/Hour = Avg Transactions/Hour × Avg Transaction Value × Commission %
Example: 1000 txn/hr × $50 × 2% = $1,000/hour
```

**Method 3: Subscription (SaaS)**
```
Revenue/Hour = (MRR × Affected Users %) / 730 hours
Example: $100K MRR, 10% users affected → $100K × 10% / 730 = $13.70/hour
(Lower because users can tolerate brief outages)
```

**Method 4: Productivity Loss (Internal Systems)**
```
Cost/Hour = Affected Employees × Avg Hourly Cost × Productivity Loss %
Example: 100 employees × $50/hr × 80% idle = $4,000/hour
```

---

## Complete Example

### Scenario: Payment API Server Failure
```typescript
// Asset Details
const asset = {
  id: 'ast_payment_api_01',
  name: 'Payment-API-Server',
  type: 'application',
  tier: 1,  // Critical
  metadata: {
    revenue_generating: true,
    compliance_critical: true  // PCI-DSS
  }
};

// Business Service
const paymentService = {
  id: 'svc_payments',
  name: 'Payment Processing',
  dependsOnAssets: ['ast_payment_api_01'],
  activeUsers: 25000,
  averageRevenuePerHour: 75000,  // $75K/hour
  slaTargetUptime: 99.99,
  tier: 1
};

// Alert
const alert = {
  id: 'alert_12345',
  severity: 'critical',
  createdAt: new Date('2026-01-08T10:00:00Z')
};

// Calculate Components
SC = calculateServiceCriticality(asset)
   = 10  // Tier 1 + revenue_gen + compliance

UA = calculateUsersAffected(asset, [paymentService])
   = 8   // 25,000 users affected

SR = calculateSLARisk(alert, [paymentService])
   = 9   // Critical alert, 10 minutes elapsed, 5 min to SLA breach

RI = calculateRevenueImpact(asset, [paymentService])
   = 9   // $75K/hour at risk

// Final Score
Business Impact Score = (10 × 8 × 9 × 9) / 100
                      = 6480 / 100
                      = 64.8
                      ≈ 65 (SIGNIFICANT - Orange Alert 🟡)

// Display to Operator
Alert Dashboard Shows:
┌─────────────────────────────────────────────┐
│ 🟡 SIGNIFICANT BUSINESS IMPACT              │
│ Score: 65/100                               │
│                                             │
│ Payment-API-Server is DOWN                  │
│                                             │
│ 💰 $75,000/hour revenue at risk            │
│ 👥 25,000 users cannot complete payments   │
│ ⏰ SLA breach in 5 minutes                 │
│ 📊 Payment Processing service affected     │
│                                             │
│ [ACKNOWLEDGE] [ASSIGN TO TEAM] [ESCALATE]  │
└─────────────────────────────────────────────┘
```

---

## Dashboard Presentation

### Alert List (Sorted by Impact)
```
Impact | Alert | Service | Revenue | Users | SLA
-------|-------|---------|---------|-------|-----
  95   | 🔴 Database cluster down | All | $500K/hr | 500K | BREACHED
  72   | 🟠 Payment API timeout | Payments | $75K/hr | 25K | 5 min
  58   | 🟡 Email server slow | Comms | $0 | 5K | 2 hrs
  31   | 🟢 Dev DB high CPU | Dev | $0 | 10 | 24 hrs
  12   | 🔵 Test env disk full | None | $0 | 0 | -
```

### Alert Detail View
```
┌──────────────────────────────────────────────────────────┐
│ Alert #12345: Payment-API-Server DOWN                    │
│                                                           │
│ BUSINESS IMPACT: 65/100 (SIGNIFICANT) 🟡                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ 💰 REVENUE AT RISK                                       │
│    $75,000 per hour                                      │
│    $1,250 per minute                                     │
│    Total lost (10 min): $12,500                         │
│                                                           │
│ 👥 USERS AFFECTED                                        │
│    25,000 active users                                   │
│    Unable to: Complete purchases, process refunds        │
│                                                           │
│ 📊 SERVICES IMPACTED                                     │
│    ⚠️ Payment Processing (Tier 1 - CRITICAL)            │
│    ⚠️ Order Management (Tier 1 - CRITICAL)              │
│    ⚠️ Refund System (Tier 2 - Important)                │
│                                                           │
│ ⏰ SLA STATUS                                            │
│    Response SLA: 15 minutes                              │
│    Time Elapsed: 10 minutes                              │
│    Time Remaining: 5 minutes ⚠️                         │
│    Status: At Risk                                       │
│                                                           │
│ 🤖 AI ROOT CAUSE ANALYSIS                               │
│    Probable Cause: Database connection pool exhausted    │
│    Confidence: 87%                                       │
│    Related Alerts: 3 suppressed (DB connection errors)   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Real-World Scenarios

### Scenario 1: E-commerce Black Friday
```
Event: Core database slow queries
Time: Black Friday, 2pm (peak shopping)

SC = 10  (Tier 1, revenue-generating)
UA = 10  (500K concurrent users)
SR = 8   (<30 min to SLA breach)
RI = 10  ($500K/hour revenue)

Impact Score = (10 × 10 × 8 × 10) / 100 = 80
→ CRITICAL 🟠 - CEO gets paged immediately
```

### Scenario 2: Internal HR System Down
```
Event: HR portal unavailable
Time: Tuesday, 10am

SC = 6   (Tier 2, important but not critical)
UA = 3   (50 HR staff affected)
SR = 4   (<8 hours to SLA breach)
RI = 2   ($2,500/hour productivity loss)

Impact Score = (6 × 3 × 4 × 2) / 100 = 1.44
→ MINOR 🔵 - Standard ticket, no urgency
```

### Scenario 3: Monitoring System Failure
```
Event: Prometheus server crashed
Time: Sunday, 3am

SC = 6   (Tier 2, operationally important)
UA = 0   (No end users affected)
SR = 4   (Non-critical SLA)
RI = 0   (No direct revenue)

Impact Score = (6 × 0 × 4 × 0) / 100 = 0
→ MINOR 🔵 - But still needs fixing!
```

---

## Configuration

### Setting Up Business Services
```typescript
// Example: Payment Processing Service
POST /api/v1/business-services

{
  "name": "Payment Processing",
  "tier": 1,
  "department": "E-commerce",
  "dependsOnAssets": [
    "ast_payment_api_01",
    "ast_payment_db_01",
    "ast_payment_gateway_01"
  ],
  "averageRevenuePerHour": 75000,
  "activeUsers": 25000,
  "slaTargetUptime": 99.99,
  "slaTargetResponseTime": 200
}
```

### Calibrating Revenue Estimates
```
Week 1: Use rough estimates
Week 2-4: Compare with actual revenue data
Month 2: Fine-tune based on outage post-mortems
Quarter 1: High confidence in impact scores
```

---

## Benefits

### For Operations Team
- ✅ Prioritize alerts by business impact, not just severity
- ✅ Justify staffing and on-call costs with revenue numbers
- ✅ Reduce alert fatigue (focus on high-impact issues)

### For Management
- ✅ Real-time visibility into revenue-at-risk
- ✅ Data-driven decisions on infrastructure investment
- ✅ SLA compliance tracking

### For Business
- ✅ Faster resolution of revenue-impacting issues
- ✅ Improved customer satisfaction
- ✅ Demonstrable ROI from monitoring investment

---

## Validation

### Testing the Formula
```python
# Unit test cases
test_cases = [
  {
    'name': 'Critical revenue system down',
    'expected_score': 80-100,
    'sc': 10, 'ua': 9, 'sr': 9, 'ri': 10
  },
  {
    'name': 'Dev environment issue',
    'expected_score': 0-20,
    'sc': 3, 'ua': 1, 'sr': 2, 'ri': 0
  },
  {
    'name': 'Important internal tool slow',
    'expected_score': 30-50,
    'sc': 6, 'ua': 4, 'sr': 5, 'ri': 3
  }
]

for test in test_cases:
    score = (test['sc'] × test['ua'] × test['sr'] × test['ri']) / 100
    assert test['expected_score'][0] <= score <= test['expected_score'][1]
```

---

## ⚠️ IMPORTANT NOTES

1. **Estimates are OK** - Perfect revenue data not required, directionally correct is sufficient
2. **Tune over time** - Adjust based on actual incident costs
3. **Include productivity** - Internal systems have cost even without revenue
4. **Document assumptions** - Store calculation basis in metadata
5. **Review quarterly** - Business changes, so should impact scores

---

**Approved by:** Pramod  
**Date:** January 8, 2026  
**Status:** LOCKED ✅