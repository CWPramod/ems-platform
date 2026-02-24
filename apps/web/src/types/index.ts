// Core Entity Types
export interface Asset {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'server' | 'firewall' | 'load_balancer' | 'application';
  ip?: string;
  ipAddress?: string;
  vendor?: string;
  model?: string;
  location?: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  metadata?: Record<string, any>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Metric {
  id: string;
  assetId: string;
  metricName: string;
  value: number;
  unit?: string;
  source: 'nms' | 'apm' | 'cloud' | 'synthetic';
  aggregationType?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  timestamp: string;
}

export interface Event {
  id: string;
  source: 'nms' | 'apm' | 'cloud' | 'synthetic';
  assetId: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  message: string;
  fingerprint: string;
  metadata?: Record<string, any>;
  affectedServices?: string[];
  correlationId?: string;
  parentEventId?: string;
  timestamp: string;
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  createdAt: string;
}

export interface Alert {
  id: string;
  eventId: string;
  event?: Event;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  owner?: string;
  team?: string;
  rootCauseAssetId?: string;
  rootCauseAsset?: Asset;
  rootCauseConfidence?: number;
  businessImpactScore?: number;
  affectedUsers?: number;
  revenueAtRisk?: number;
  correlatedAlertIds?: string[];
  suppressedBy?: string;
  slaDeadline?: string;
  slaBreached: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionNotes?: string;
  resolutionCategory?: string;
  updatedAt: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}

// ML Types
export interface AnomalyDetectionResult {
  is_anomaly: boolean;
  score: number;
  confidence: number;
  reason: string;
}

export interface RootCauseResult {
  root_cause_asset_id: string;
  confidence: number;
  reason: string;
}

export interface CorrelationGroup {
  type: 'fingerprint' | 'asset' | 'time_cluster';
  key: string;
  alert_count: number;
  alert_ids: string[];
  correlation_score: number;
  reason: string;
}

export interface CorrelationResult {
  total_alerts: number;
  correlation_groups: CorrelationGroup[];
  alert_storm_detected: boolean;
  unique_fingerprints: number;
  unique_assets: number;
  time_clusters: number;
}

export interface HealthScore {
  health_score: number;
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  is_anomaly: boolean;
  anomalous_metrics_count: number;
  confidence: number;
}

// Dashboard Types
export interface DashboardStats {
  totalAssets: number;
  onlineAssets: number;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  averageHealthScore: number;
}
// ============================================================================
// NMS TYPES - Add these to your existing types/index.ts
// ============================================================================

// Network Device (extends Asset with network-specific fields)
export interface NetworkDevice {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'firewall' | 'load_balancer' | 'access_point' | string;
  ipAddress: string;
  status: 'reachable' | 'unreachable' | 'degraded' | string;
  vendor?: string;
  model?: string;
  location?: string;
  uptime?: number; // percentage
  lastSeen?: string;
  metadata?: {
    snmpCommunity?: string;
    snmpVersion?: string;
    snmpPort?: number;
    deviceType?: string;
    manufacturer?: string;
    [key: string]: any;
  };
}

// NMS Status Response
export interface NMSStatus {
  isPolling: boolean;
  totalDevices: number;
  reachableDevices: number;
  unreachableDevices: number;
  emsCoreUrl: string;
  devices: NetworkDevice[];
}

// Device Metric
export interface DeviceMetric {
  assetId: string;
  metricName: string; // cpu_usage, memory_usage, bandwidth_usage, packet_loss, etc.
  value: number;
  unit?: string;
  timestamp: string;
  tags?: {
    [key: string]: string;
  };
}
// ============================================================================
// ML SERVICE TYPES
// ============================================================================

// ML Health Response
export interface MLHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: boolean;
  redis: boolean | null;
  models: {
    anomaly_detection: boolean;
  };
}

// Anomaly Detection Types
export interface AnomalyResult {
  assetId: number;
  assetName: string;
  metricName: string;
  value: number;
  score: number;
  isAnomaly: boolean;
  threshold: number;
  timestamp: string;
  metadata?: {
    deviation?: number;
    model?: string;
    method?: string;
  };
}

export interface AnomalyDetectionResponse {
  success: boolean;
  totalAnalyzed: number;
  anomaliesDetected: number;
  results: AnomalyResult[];
  metadata?: {
    threshold: number;
    time_range_seconds: number;
    model_type: 'ml' | 'statistical';
  };
}

export interface AnomalyDetectionRequest {
  assetId?: number;
  metricNames?: string[];
  timeRange?: number;
  threshold?: number;
}

// Model Training Types
export interface TrainModelRequest {
  modelType: string;
  assetIds?: number[];
  timeRange?: number;
  parameters?: Record<string, any>;
}

export interface TrainModelResponse {
  success: boolean;
  message: string;
  modelType: string;
  modelVersion: string;
  trainingMetrics?: {
    samples_trained: number;
    contamination: number;
    mean_score: number;
    std_score: number;
    anomalies_detected: number;
    normal_detected: number;
  };
  trainingSamples: number;
  trainingDuration: number;
}

// Model Info Types
export interface ModelInfo {
  modelType: string;
  modelVersion: string;
  trainingDate: string;
  status: string;
  metrics?: Record<string, any>;
  parameters?: Record<string, any>;
}

export interface ModelsListResponse {
  success: boolean;
  models: ModelInfo[];
  totalModels: number;
}

// Asset Metrics Types
export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface AssetMetricsResponse {
  assetId: number;
  assetName: string;
  metricName: string;
  unit: string;
  data: MetricDataPoint[];
  statistics?: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q25: number;
    q75: number;
    count: number;
  };
}

// Anomaly Scores History
export interface AnomalyScore {
  metricName: string;
  score: number;
  isAnomaly: boolean;
  threshold: number;
  timestamp: string;
}

export interface AnomalyScoresResponse {
  success: boolean;
  assetId: number;
  scores: AnomalyScore[];
  total: number;
}

// ============================================================================
// SECURITY TYPES
// ============================================================================

// SSL/TLS Certificate
export interface SslCertificate {
  id: string;
  hostname: string;
  port: number;
  issuer: string;
  subject: string;
  serialNumber: string;
  fingerprint: string;
  status: 'valid' | 'expired' | 'expiring_soon' | 'self_signed' | 'invalid' | 'revoked';
  tlsVersion: string;
  cipherSuite: string;
  keyLength: number;
  isSelfSigned: boolean;
  isChainValid: boolean;
  issuedAt: string;
  expiresAt: string;
  daysUntilExpiry: number;
  securityScore: number;
  vulnerabilities: string[];
  metadata?: Record<string, any>;
  assetId?: string;
  lastChecked: string;
  createdAt: string;
  updatedAt: string;
}

export interface SslSummary {
  total: number;
  valid: number;
  expired: number;
  expiringSoon: number;
  selfSigned: number;
  invalid: number;
  revoked: number;
  averageSecurityScore: number;
  statusBreakdown: { status: string; count: number }[];
}

// IOC Entry
export interface IocEntry {
  id: string;
  type: 'ip_address' | 'domain' | 'url' | 'file_hash' | 'email';
  indicator: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'matched' | 'expired' | 'false_positive';
  threatType: string;
  description: string;
  matchCount: number;
  lastMatchedAt: string | null;
  lastMatchedSourceIp: string | null;
  lastMatchedDestIp: string | null;
  metadata?: Record<string, any>;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IocSummary {
  total: number;
  active: number;
  matched: number;
  expired: number;
  falsePositive: number;
  totalMatches: number;
  byType: { type: string; count: string }[];
  bySeverity: { severity: string; count: string }[];
}

// Signature Alert
export interface SignatureAlert {
  id: string;
  signatureId: string;
  signatureName: string;
  category: 'malware' | 'exploit' | 'reconnaissance' | 'policy_violation' | 'protocol_anomaly' | 'suspicious';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  action: 'alert' | 'drop' | 'reject' | 'log';
  sourceIp: string;
  sourcePort: number;
  destinationIp: string;
  destinationPort: number;
  protocol: string;
  assetId?: string;
  packetPayload?: string;
  packetLength?: number;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  status: 'open' | 'acknowledged' | 'dismissed' | 'escalated';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  escalatedBy?: string;
  escalatedAt?: string;
  escalationNotes?: string;
  createdAt: string;
}

export interface SignatureSummary {
  total: number;
  last24h: number;
  criticalLastHour: number;
  bySeverity: { severity: string; count: string }[];
  byCategory: { category: string; count: string }[];
}

export interface PacketDrilldown {
  alertId: string;
  signatureId: string;
  signatureName: string;
  packetLength: number;
  hexDump: string;
  rawBase64: string;
}

// DDoS Event
export interface DdosEvent {
  id: string;
  attackType: 'volumetric' | 'application' | 'protocol' | 'scanning';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'mitigated' | 'resolved';
  targetIp: string;
  targetPort: number;
  sourceIps: string[];
  targetAssetName: string;
  targetAssetId?: string;
  routerInterface: string;
  customerName: string;
  asn: string;
  peakBandwidthGbps: number;
  peakPps: number;
  totalPackets: number;
  totalBytes: number;
  durationSeconds: number;
  attackVectors: string[];
  description: string;
  mitigationStrategy?: string;
  mitigationInitiatedBy?: string;
  mitigationNotes?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  metadata?: Record<string, any>;
  detectedAt: string;
  mitigatedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DdosSummary {
  total: number;
  active: number;
  mitigated: number;
  resolved: number;
  peakBandwidthGbps: number;
  averageDurationSeconds: number;
  byType: { attackType: string; count: string }[];
}

export interface DdosReport {
  event: DdosEvent;
  analysis: {
    targetDetails: {
      ip: string;
      port: number;
      assetName: string;
      routerInterface: string;
      customerName: string;
      asn: string;
    };
    attackProfile: {
      type: string;
      vectors: string[];
      peakBandwidthGbps: number;
      peakPps: number;
      totalPackets: number;
      totalBytes: number;
      totalGB: string;
      durationSeconds: number;
      durationMinutes: number;
    };
    sourceAnalysis: {
      totalSources: number;
      sourceIps: string[];
    };
    impact: {
      severity: string;
      status: string;
      detectedAt: string;
      mitigatedAt: string | null;
      resolvedAt: string | null;
      timeToMitigate: number | null;
    };
    mitigation?: {
      strategy: string | null;
      initiatedBy: string | null;
      notes: string | null;
      resolvedBy: string | null;
      resolutionNotes: string | null;
    };
  };
}

// IOC Create Payload
export interface IocCreatePayload {
  type: string;
  indicator: string;
  source: string;
  severity?: string;
  threatType?: string;
  description?: string;
}

export interface SecurityOverview {
  ssl: { averageScore: number; total: number; expired: number; expiringSoon: number };
  ioc: { totalMatches: number; active: number; matched: number };
  signatures: { total: number; last24h: number; criticalLastHour: number };
  ddos: { active: number; mitigated: number; peakBandwidthGbps: number };
}

// ============================================================================
// ITSM TYPES
// ============================================================================

export interface ITSMTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description?: string;
  type: 'incident' | 'problem' | 'change';
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'open' | 'acknowledged' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  assetId?: string;
  alertId?: string;
  problemId?: string;
  assignedTo?: string;
  createdBy: string;
  slaPolicyId?: string;
  slaPolicy?: ITSMSlaPolicy;
  slaDueAt?: string;
  breached: boolean;
  resolutionNotes?: string;
  source: 'manual' | 'auto_alert' | 'email' | 'api';
  pendingDurationMs: number;
  pendingSince?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITSMSlaPolicy {
  id: string;
  name: string;
  severity: string;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  escalationLevel1Minutes: number;
  escalationLevel2Minutes: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ITSMTicketComment {
  id: string;
  ticketId: string;
  comment: string;
  visibility: 'public' | 'internal';
  createdBy: string;
  createdAt: string;
}

export interface ITSMTicketHistory {
  id: string;
  ticketId: string;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  changedBy: string;
  changedAt: string;
}

export interface ITSMProblem {
  id: string;
  title: string;
  description?: string;
  rootCause?: string;
  workaround?: string;
  status: 'open' | 'investigating' | 'known_error' | 'resolved' | 'closed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITSMChange {
  id: string;
  changeNumber?: string;
  title: string;
  description?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'implemented' | 'rolled_back';
  scheduledStart?: string;
  scheduledEnd?: string;
  approvedBy?: string;
  implementationNotes?: string;
  rollbackPlan?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITSMKbArticle {
  id: string;
  title: string;
  content: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  category?: string;
  tags?: string[];
  viewCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITSMSlaDashboard {
  totalTickets: number;
  breachedTickets: number;
  compliancePercent: number;
  mttrMinutes: number | null;
  mttaMinutes: number | null;
}

export interface ITSMBreachRateBySeverity {
  severity: string;
  total: number;
  breached: number;
  breachRate: number;
}

export interface ITSMComplianceTrend {
  date: string;
  total: number;
  breached: number;
  compliancePercent: number;
}

export interface ITSMEscalationFrequency {
  date: string;
  fieldChanged: string;
  count: number;
}