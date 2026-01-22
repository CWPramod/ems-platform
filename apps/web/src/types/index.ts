// Core Entity Types
export interface Asset {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'server' | 'firewall' | 'load_balancer' | 'application';
  ipAddress?: string;
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