import axios from 'axios';
import type {
  Asset,
  Alert,
  Metric,
  Event,
  PaginatedResponse,
  AnomalyDetectionResult,
  RootCauseResult,
  CorrelationResult,
  HealthScore,
} from '../types';

// API Base URLs
const NEST_API_BASE = 'http://localhost:3100';
const ML_API_BASE = 'http://localhost:8000';

// Create axios instances
const nestAPI = axios.create({
  baseURL: NEST_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

const mlAPIClient = axios.create({
  baseURL: ML_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// ASSETS API
// ============================================================================

export const assetsAPI = {
  getAll: async (): Promise<PaginatedResponse<Asset>> => {
    const response = await nestAPI.get('/assets');
    return response.data;
  },

  getById: async (id: string): Promise<Asset> => {
    const response = await nestAPI.get(`/assets/${id}`);
    return response.data;
  },

  create: async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> => {
    const response = await nestAPI.post('/assets', asset);
    return response.data;
  },

  update: async (id: string, updates: Partial<Asset>): Promise<Asset> => {
    const response = await nestAPI.patch(`/assets/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await nestAPI.delete(`/assets/${id}`);
  },
};

// ============================================================================
// METRICS API
// ============================================================================

export const metricsAPI = {
  query: async (params: {
    assetId?: string;
    metricName?: string;
    from?: string;
    to?: string;
  }): Promise<Metric[]> => {
    const response = await nestAPI.get('/metrics', { params });
    return response.data.data || response.data;
  },

  create: async (metric: Omit<Metric, 'id'>): Promise<Metric> => {
    const response = await nestAPI.post('/metrics', metric);
    return response.data;
  },

  createBatch: async (metrics: Omit<Metric, 'id'>[]): Promise<{ accepted: number; rejected: number }> => {
    const response = await nestAPI.post('/metrics/batch', { metrics });
    return response.data;
  },
};

// ============================================================================
// EVENTS API
// ============================================================================

export const eventsAPI = {
  getAll: async (params?: {
    source?: string;
    severity?: string;
    since?: string;
  }): Promise<PaginatedResponse<Event>> => {
    const response = await nestAPI.get('/events', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Event> => {
    const response = await nestAPI.get(`/events/${id}`);
    return response.data;
  },

  create: async (event: Omit<Event, 'id' | 'firstOccurrence' | 'lastOccurrence' | 'occurrenceCount' | 'createdAt'>): Promise<Event> => {
    const response = await nestAPI.post('/events', event);
    return response.data;
  },
};

// ============================================================================
// ALERTS API
// ============================================================================

export const alertsAPI = {
  getAll: async (params?: {
    status?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Alert>> => {
    const response = await nestAPI.get('/alerts', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Alert> => {
    const response = await nestAPI.get(`/alerts/${id}`);
    return response.data;
  },

  create: async (alert: { eventId: string }): Promise<Alert> => {
    const response = await nestAPI.post('/alerts', alert);
    return response.data;
  },

  acknowledge: async (id: string, data: { acknowledgedBy: string; notes?: string }): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/acknowledge`, data);
    return response.data;
  },

  resolve: async (id: string, data: { resolvedBy: string; notes: string; resolutionCategory: string }): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/resolve`, data);
    return response.data;
  },

  close: async (id: string, data: { closedBy: string; notes?: string }): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/close`, data);
    return response.data;
  },

  updateBusinessImpact: async (id: string, data: {
    businessImpactScore: number;
    affectedUsers?: number;
    revenueAtRisk?: number;
  }): Promise<Alert> => {
    const response = await nestAPI.patch(`/alerts/${id}/business-impact`, data);
    return response.data;
  },
};

// ============================================================================
// ML API - Enhanced Features
// ============================================================================

export const mlAPI = {
  // Asset Health Analysis
  analyzeAssetHealth: async (assetId: string): Promise<HealthScore & {
    asset_id: string;
    metrics_analyzed: number;
    anomalies_detected: number;
    anomaly_details: Record<string, any>;
    recent_events_count: number;
    timestamp: string;
  }> => {
    const response = await mlAPIClient.post('/ml/enhanced/analyze-asset-health', { asset_id: assetId });
    return response.data;
  },

  // Database Status
  getDatabaseStatus: async (): Promise<{
    database_connected: boolean;
    metrics_in_database: number;
    status: string;
  }> => {
    const response = await mlAPIClient.get('/ml/enhanced/database-status');
    return response.data;
  },

  // Anomaly Detection
  detectAnomaly: async (data: {
    value: number;
    historical_data?: number[];
  }): Promise<AnomalyDetectionResult> => {
    const response = await mlAPIClient.post('/ml/detect-anomaly', data);
    return response.data;
  },

  // Root Cause Analysis
  analyzeRootCause: async (data: {
    event: Event;
    related_events: Event[];
    asset_metrics: Record<string, number[]>;
  }): Promise<RootCauseResult> => {
    const response = await mlAPIClient.post('/ml/analyze-root-cause', data);
    return response.data;
  },

  // Alert Correlation
  findCorrelations: async (data: {
    alerts: Alert[];
    time_window_minutes: number;
  }): Promise<CorrelationResult> => {
    const response = await mlAPIClient.post('/ml/correlation/find-correlations', data);
    return response.data;
  },

  // Suppression Suggestions
  suggestSuppression: async (data: {
    alerts: Alert[];
    time_window_minutes: number;
  }): Promise<{
    correlation_analysis: CorrelationResult;
    suppression_suggestions: {
      suppression_suggestions: Array<{
        group_type: string;
        keep_alert_id: string;
        suppress_alert_ids: string[];
        reason: string;
        alerts_to_suppress: number;
      }>;
      total_alerts: number;
      suppressible_alerts: number;
      noise_reduction_percent: number;
    };
  }> => {
    const response = await mlAPIClient.post('/ml/correlation/suggest-suppression', data);
    return response.data;
  },

  // Multi-Metric Detection
  analyzeMultiMetric: async (data: {
    metric_values: Record<string, number>;
  }): Promise<{
    metric_values: Record<string, number>;
    is_anomaly: boolean;
    score: number;
    confidence: number;
    anomalous_metrics: Array<{
      metric: string;
      value: number;
      z_score: number;
      expected_range: string;
    }>;
    reason: string;
  }> => {
    const response = await mlAPIClient.post('/ml/multi-metric/detect', data);
    return response.data;
  },

  // Composite Health Score
  calculateCompositeHealth: async (data: {
    metric_values: Record<string, number>;
  }): Promise<{
    metric_values: Record<string, number>;
    health_score: number;
    status: 'healthy' | 'warning' | 'degraded' | 'critical';
    is_anomaly: boolean;
    anomalous_metrics_count: number;
    confidence: number;
  }> => {
    const response = await mlAPIClient.post('/ml/multi-metric/composite-health', data);
    return response.data;
  },
};

// ============================================================================
// Health Check
// ============================================================================

export const healthAPI = {
  checkNestJS: async (): Promise<boolean> => {
    try {
      await nestAPI.get('/');
      return true;
    } catch {
      return false;
    }
  },

  checkML: async (): Promise<boolean> => {
    try {
      await mlAPIClient.get('/health');
      return true;
    } catch {
      return false;
    }
  },
};

// Export all
export default {
  assets: assetsAPI,
  metrics: metricsAPI,
  events: eventsAPI,
  alerts: alertsAPI,
  ml: mlAPI,
  health: healthAPI,
};