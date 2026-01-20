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