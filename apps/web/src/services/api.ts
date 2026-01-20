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
  NMSStatus,
  DeviceMetric,
} from '../types';

// API Base URLs
const NEST_API_BASE = 'http://localhost:3100';
const ML_API_BASE = 'http://localhost:8000';
const NMS_API_BASE = 'http://localhost:3001';

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

const nmsAPIClient = axios.create({
  baseURL: NMS_API_BASE,
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

  create: async (event: Omit<Event, 'id' | 'createdAt'>): Promise<Event> => {
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
    severity?: string;
    sortBy?: string;
    order?: string;
  }): Promise<PaginatedResponse<Alert>> => {
    const response = await nestAPI.get('/alerts', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Alert> => {
    const response = await nestAPI.get(`/alerts/${id}`);
    return response.data;
  },

  acknowledge: async (id: string): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  resolve: async (id: string, resolution?: string): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/resolve`, { resolution });
    return response.data;
  },
};

// ============================================================================
// ML API
// ============================================================================

export const mlAPI = {
  analyzeAssetHealth: async (assetId: string): Promise<HealthScore> => {
    const response = await mlAPIClient.get(`/ml/asset-health/${assetId}`);
    return response.data;
  },

  detectAnomalies: async (params: {
    assetId?: string;
    metricName?: string;
    window?: number;
  }): Promise<AnomalyDetectionResult> => {
    const response = await mlAPIClient.post('/ml/detect-anomalies', params);
    return response.data;
  },

  findRootCause: async (params: {
    eventId: string;
    timeWindow?: number;
  }): Promise<RootCauseResult> => {
    const response = await mlAPIClient.post('/ml/root-cause', params);
    return response.data;
  },

  findCorrelations: async (params: {
    assetIds?: string[];
    timeRange?: string;
  }): Promise<CorrelationResult> => {
    const response = await mlAPIClient.post('/ml/correlations', params);
    return response.data;
  },
};

// ============================================================================
// NMS API (Network Management System)
// ============================================================================

export const nmsAPI = {
  // Get NMS status and device list
  getStatus: async (): Promise<NMSStatus> => {
    const response = await nmsAPIClient.get('/nms/status');
    return response.data;
  },

  // Trigger device discovery
  triggerDiscovery: async (): Promise<{ message: string; status: string }> => {
    const response = await nmsAPIClient.post('/nms/discover');
    return response.data;
  },

  // Get current metrics for all devices
  getMetrics: async (): Promise<DeviceMetric[]> => {
    const response = await nmsAPIClient.get('/nms/metrics');
    return response.data;
  },

  // Get metrics for a specific device
  getDeviceMetrics: async (assetId: string): Promise<DeviceMetric[]> => {
    const response = await nmsAPIClient.get(`/nms/metrics/${assetId}`);
    return response.data;
  },
};

// ============================================================================
// HEALTH API
// ============================================================================

export const healthAPI = {
  checkNestJS: async (): Promise<boolean> => {
    try {
      const response = await nestAPI.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  },

  checkML: async (): Promise<boolean> => {
    try {
      const response = await mlAPIClient.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  },

  checkNMS: async (): Promise<boolean> => {
    try {
      const response = await nmsAPIClient.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  },
};

export default {
  assetsAPI,
  metricsAPI,
  eventsAPI,
  alertsAPI,
  mlAPI,
  nmsAPI,
  healthAPI,
};
