import axios from 'axios';
import type {
  Asset,
  Alert,
  Metric,
  Event,
  PaginatedResponse,
  NMSStatus,
  DeviceMetric,
  MLHealthResponse,
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  TrainModelRequest,
  TrainModelResponse,
  ModelsListResponse,
  AssetMetricsResponse,
  AnomalyScoresResponse,
  SslCertificate,
  SslSummary,
  IocEntry,
  IocSummary,
  IocCreatePayload,
  SignatureAlert,
  SignatureSummary,
  PacketDrilldown,
  DdosEvent,
  DdosSummary,
  DdosReport,
  SecurityOverview,
  ITSMTicket,
  ITSMTicketComment,
  ITSMTicketHistory,
  ITSMSlaPolicy,
  ITSMSlaDashboard,
  ITSMBreachRateBySeverity,
  ITSMComplianceTrend,
  ITSMEscalationFrequency,
  ITSMProblem,
  ITSMChange,
  ITSMKbArticle,
} from '../types';

// API Base URLs
const NEST_API_BASE = 'http://localhost:3100';
const ML_API_BASE = 'http://localhost:8000';
const NMS_API_BASE = 'http://localhost:3001';
const ITSM_API_BASE = 'http://localhost:3005';

// Create axios instances
const nestAPI = axios.create({
  baseURL: NEST_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor to nestAPI
nestAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

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

const itsmAPIClient = axios.create({
  baseURL: ITSM_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor to itsmAPIClient
itsmAPIClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

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
    owner?: string;
    team?: string;
    slaBreached?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Alert>> => {
    const response = await nestAPI.get('/alerts', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Alert> => {
    const response = await nestAPI.get(`/alerts/${id}`);
    return response.data;
  },

  acknowledge: async (id: string, owner: string): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/acknowledge`, { owner });
    return response.data;
  },

  resolve: async (id: string, data?: { resolutionNotes?: string; resolutionCategory?: string }): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/resolve`, data);
    return response.data;
  },

  close: async (id: string): Promise<Alert> => {
    const response = await nestAPI.post(`/alerts/${id}/close`);
    return response.data;
  },
};

// ============================================================================
// ML API
// ============================================================================

export const mlAPI = {
  // Health Check
  health: async (): Promise<MLHealthResponse> => {
    const response = await mlAPIClient.get('/api/v1/health');
    return response.data;
  },

  // Anomaly Detection
  detectAnomalies: async (params: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> => {
    const response = await mlAPIClient.post('/api/v1/anomaly/detect', params);
    return response.data;
  },

  // Train Model
  trainModel: async (params: TrainModelRequest): Promise<TrainModelResponse> => {
    const response = await mlAPIClient.post('/api/v1/anomaly/train', params);
    return response.data;
  },

  // List Models
  listModels: async (): Promise<ModelsListResponse> => {
    const response = await mlAPIClient.get('/api/v1/models');
    return response.data;
  },

  // Get Asset Metrics
  getAssetMetrics: async (assetId: number, hours: number = 24): Promise<AssetMetricsResponse> => {
    const response = await mlAPIClient.get(`/api/v1/metrics/${assetId}?hours=${hours}`);
    return response.data;
  },

  // Get Anomaly Scores History
  getAnomalyScores: async (assetId: number, hours: number = 24): Promise<AnomalyScoresResponse> => {
    const response = await mlAPIClient.get(`/api/v1/anomaly/scores/${assetId}?hours=${hours}`);
    return response.data;
  },

  // Analyze asset health
  analyzeAssetHealth: async (assetId: string | number): Promise<{ health_score: number; status: string }> => {
    const response = await mlAPIClient.get(`/api/v1/health/asset/${assetId}`);
    return response.data;
  },

  // Find correlations between alerts
  findCorrelations: async (params: { alerts: any[]; time_window_minutes: number }): Promise<any> => {
    const response = await mlAPIClient.post('/api/v1/correlations/find', params);
    return response.data;
  },

  // Quick anomaly check for specific asset (convenience method)
  checkAssetAnomalies: async (assetId: number, threshold: number = 0.7): Promise<AnomalyDetectionResponse> => {
    return mlAPI.detectAnomalies({
      assetId,
      timeRange: 3600, // Last hour
      threshold,
    });
  },

  // Train model with default settings (convenience method)
  trainDefault: async (): Promise<TrainModelResponse> => {
    return mlAPI.trainModel({
      modelType: 'anomaly_detection',
      timeRange: 86400, // Last 24 hours
    });
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
    const response = await mlAPIClient.get('/api/v1/health', { timeout: 5000 });
    return response.status === 200 && response.data.status === 'healthy';
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

// ============================================================================
// SECURITY API
// ============================================================================

export const securityAPI = {
  // Overview
  getOverview: async (): Promise<SecurityOverview> => {
    const response = await nestAPI.get('/api/v1/security/overview');
    return response.data;
  },

  // SSL/TLS
  getSslCertificates: async (params?: {
    status?: string;
    hostname?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SslCertificate[]; total: number }> => {
    const response = await nestAPI.get('/api/v1/security/ssl/certificates', { params });
    return response.data;
  },

  getSslCertificateById: async (id: string): Promise<SslCertificate> => {
    const response = await nestAPI.get(`/api/v1/security/ssl/certificates/${id}`);
    return response.data;
  },

  getSslSummary: async (): Promise<SslSummary> => {
    const response = await nestAPI.get('/api/v1/security/ssl/summary');
    return response.data;
  },

  scanSslHost: async (hostname: string, port?: number): Promise<any> => {
    const response = await nestAPI.post('/api/v1/security/ssl/scan', { hostname, port });
    return response.data;
  },

  // IOC
  getIocEntries: async (params?: {
    type?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: IocEntry[]; total: number }> => {
    const response = await nestAPI.get('/api/v1/security/ioc/entries', { params });
    return response.data;
  },

  getIocEntryById: async (id: string): Promise<IocEntry> => {
    const response = await nestAPI.get(`/api/v1/security/ioc/entries/${id}`);
    return response.data;
  },

  getIocSummary: async (): Promise<IocSummary> => {
    const response = await nestAPI.get('/api/v1/security/ioc/summary');
    return response.data;
  },

  getIocRecentMatches: async (limit?: number): Promise<IocEntry[]> => {
    const response = await nestAPI.get('/api/v1/security/ioc/recent-matches', {
      params: { limit },
    });
    return response.data;
  },

  createIocEntry: async (data: IocCreatePayload): Promise<IocEntry> => {
    const response = await nestAPI.post('/api/v1/security/ioc/entries', data);
    return response.data;
  },

  importIocCsv: async (csvContent: string): Promise<{ imported: number; errors: number }> => {
    const response = await nestAPI.post('/api/v1/security/ioc/import', { csvContent });
    return response.data;
  },

  updateIocStatus: async (id: string, status: string): Promise<IocEntry> => {
    const response = await nestAPI.put(`/api/v1/security/ioc/entries/${id}/status`, { status });
    return response.data;
  },

  // Signatures
  getSignatureAlerts: async (params?: {
    category?: string;
    severity?: string;
    status?: string;
    sourceIp?: string;
    destinationIp?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SignatureAlert[]; total: number }> => {
    const response = await nestAPI.get('/api/v1/security/signatures/alerts', { params });
    return response.data;
  },

  getSignatureAlertById: async (id: string): Promise<SignatureAlert> => {
    const response = await nestAPI.get(`/api/v1/security/signatures/alerts/${id}`);
    return response.data;
  },

  getSignatureSummary: async (): Promise<SignatureSummary> => {
    const response = await nestAPI.get('/api/v1/security/signatures/summary');
    return response.data;
  },

  getPacketDrilldown: async (id: string): Promise<PacketDrilldown> => {
    const response = await nestAPI.get(`/api/v1/security/signatures/alerts/${id}/packet`);
    return response.data;
  },

  acknowledgeSignatureAlert: async (id: string, by: string): Promise<SignatureAlert> => {
    const response = await nestAPI.post(`/api/v1/security/signatures/alerts/${id}/acknowledge`, { by });
    return response.data;
  },

  dismissSignatureAlert: async (id: string, by: string): Promise<SignatureAlert> => {
    const response = await nestAPI.post(`/api/v1/security/signatures/alerts/${id}/dismiss`, { by });
    return response.data;
  },

  escalateSignatureAlert: async (id: string, by: string, notes?: string): Promise<SignatureAlert> => {
    const response = await nestAPI.post(`/api/v1/security/signatures/alerts/${id}/escalate`, { by, notes });
    return response.data;
  },

  bulkSignatureAction: async (ids: string[], action: string, by: string, notes?: string): Promise<{ updated: number }> => {
    const response = await nestAPI.post('/api/v1/security/signatures/alerts/bulk-action', { ids, action, by, notes });
    return response.data;
  },

  // DDoS
  getDdosEvents: async (params?: {
    status?: string;
    attackType?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DdosEvent[]; total: number }> => {
    const response = await nestAPI.get('/api/v1/security/ddos/events', { params });
    return response.data;
  },

  getDdosEventById: async (id: string): Promise<DdosEvent> => {
    const response = await nestAPI.get(`/api/v1/security/ddos/events/${id}`);
    return response.data;
  },

  getDdosSummary: async (): Promise<DdosSummary> => {
    const response = await nestAPI.get('/api/v1/security/ddos/summary');
    return response.data;
  },

  getDdosActiveAttacks: async (): Promise<DdosEvent[]> => {
    const response = await nestAPI.get('/api/v1/security/ddos/active');
    return response.data;
  },

  getDdosReport: async (id: string): Promise<DdosReport> => {
    const response = await nestAPI.get(`/api/v1/security/ddos/report/${id}`);
    return response.data;
  },

  mitigateDdosEvent: async (id: string, data: { strategy: string; initiatedBy: string; notes?: string }): Promise<DdosEvent> => {
    const response = await nestAPI.post(`/api/v1/security/ddos/events/${id}/mitigate`, data);
    return response.data;
  },

  resolveDdosEvent: async (id: string, data: { resolvedBy: string; notes?: string }): Promise<DdosEvent> => {
    const response = await nestAPI.post(`/api/v1/security/ddos/events/${id}/resolve`, data);
    return response.data;
  },
};

// ============================================================================
// ITSM API (port 3005)
// ============================================================================

export const itsmTicketsAPI = {
  getAll: async (params?: {
    page?: number; limit?: number; status?: string;
    severity?: string; priority?: string; type?: string;
    assignedTo?: string; search?: string; slaBreach?: string;
    sort?: string;
  }): Promise<{ data: ITSMTicket[]; total: number; page: number; limit: number }> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/tickets', { params });
    return response.data;
  },
  getById: async (id: string): Promise<ITSMTicket> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/tickets/${id}`);
    return response.data;
  },
  create: async (data: Partial<ITSMTicket>): Promise<ITSMTicket> => {
    const response = await itsmAPIClient.post('/api/v1/itsm/tickets', data);
    return response.data;
  },
  updateStatus: async (id: string, data: { status: string; resolutionNotes?: string }): Promise<ITSMTicket> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/tickets/${id}/status`, data);
    return response.data;
  },
  assign: async (id: string, data: { assignedTo: string }): Promise<ITSMTicket> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/tickets/${id}/assign`, data);
    return response.data;
  },
  getComments: async (id: string): Promise<ITSMTicketComment[]> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/tickets/${id}/comments`);
    return response.data;
  },
  addComment: async (id: string, data: { comment: string; visibility?: string }): Promise<ITSMTicketComment> => {
    const response = await itsmAPIClient.post(`/api/v1/itsm/tickets/${id}/comments`, data);
    return response.data;
  },
  getHistory: async (id: string): Promise<ITSMTicketHistory[]> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/tickets/${id}/history`);
    return response.data;
  },
};

export const itsmSlaAPI = {
  getDashboard: async (): Promise<ITSMSlaDashboard> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/dashboard');
    return response.data;
  },
  getBreaches: async (): Promise<ITSMTicket[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/breaches');
    return response.data;
  },
  getAtRisk: async (threshold?: number): Promise<ITSMTicket[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/at-risk', { params: { threshold } });
    return response.data;
  },
  getBreachRate: async (): Promise<ITSMBreachRateBySeverity[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/breach-rate');
    return response.data;
  },
  getComplianceTrend: async (days?: number): Promise<ITSMComplianceTrend[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/compliance-trend', { params: { days } });
    return response.data;
  },
  getEscalationFrequency: async (days?: number): Promise<ITSMEscalationFrequency[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/escalation-frequency', { params: { days } });
    return response.data;
  },
  getPolicies: async (): Promise<ITSMSlaPolicy[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/sla/policies');
    return response.data;
  },
  createPolicy: async (data: Partial<ITSMSlaPolicy>): Promise<ITSMSlaPolicy> => {
    const response = await itsmAPIClient.post('/api/v1/itsm/sla/policies', data);
    return response.data;
  },
};

export const itsmProblemsAPI = {
  getAll: async (params?: {
    page?: number; limit?: number; status?: string; search?: string;
  }): Promise<{ data: ITSMProblem[]; total: number; page: number; limit: number }> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/problems', { params });
    return response.data;
  },
  getById: async (id: string): Promise<ITSMProblem> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/problems/${id}`);
    return response.data;
  },
  create: async (data: Partial<ITSMProblem>): Promise<ITSMProblem> => {
    const response = await itsmAPIClient.post('/api/v1/itsm/problems', data);
    return response.data;
  },
  update: async (id: string, data: Partial<ITSMProblem>): Promise<ITSMProblem> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/problems/${id}`, data);
    return response.data;
  },
  updateStatus: async (id: string, data: { status: string }): Promise<ITSMProblem> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/problems/${id}/status`, data);
    return response.data;
  },
  getKnownErrors: async (params?: { page?: number; limit?: number }): Promise<{ data: ITSMProblem[]; total: number }> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/problems/known-errors', { params });
    return response.data;
  },
  suggest: async (query: string): Promise<ITSMProblem[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/problems/suggest', { params: { query } });
    return response.data;
  },
  getLinkedIncidents: async (id: string): Promise<ITSMTicket[]> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/problems/${id}/incidents`);
    return response.data;
  },
  linkIncident: async (id: string, data: { ticketId: string }): Promise<ITSMTicket> => {
    const response = await itsmAPIClient.post(`/api/v1/itsm/problems/${id}/incidents`, data);
    return response.data;
  },
};

export const itsmChangesAPI = {
  getAll: async (params?: {
    page?: number; limit?: number; approvalStatus?: string;
    riskLevel?: string; search?: string;
  }): Promise<{ data: ITSMChange[]; total: number; page: number; limit: number }> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/changes', { params });
    return response.data;
  },
  getById: async (id: string): Promise<ITSMChange> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/changes/${id}`);
    return response.data;
  },
  create: async (data: Partial<ITSMChange>): Promise<ITSMChange> => {
    const response = await itsmAPIClient.post('/api/v1/itsm/changes', data);
    return response.data;
  },
  update: async (id: string, data: Partial<ITSMChange>): Promise<ITSMChange> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/changes/${id}`, data);
    return response.data;
  },
  updateStatus: async (id: string, data: { approvalStatus: string; implementationNotes?: string }): Promise<ITSMChange> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/changes/${id}/status`, data);
    return response.data;
  },
  getCalendar: async (startDate?: string, endDate?: string): Promise<ITSMChange[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/changes/calendar', { params: { startDate, endDate } });
    return response.data;
  },
  getConflicts: async (id: string): Promise<ITSMChange[]> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/changes/${id}/conflicts`);
    return response.data;
  },
};

export const itsmKbAPI = {
  getAll: async (params?: {
    page?: number; limit?: number; search?: string;
    category?: string; status?: string;
  }): Promise<{ data: ITSMKbArticle[]; total: number; page: number; limit: number }> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/kb/articles', { params });
    return response.data;
  },
  getById: async (id: string): Promise<ITSMKbArticle> => {
    const response = await itsmAPIClient.get(`/api/v1/itsm/kb/articles/${id}`);
    return response.data;
  },
  create: async (data: Partial<ITSMKbArticle>): Promise<ITSMKbArticle> => {
    const response = await itsmAPIClient.post('/api/v1/itsm/kb/articles', data);
    return response.data;
  },
  update: async (id: string, data: Partial<ITSMKbArticle>): Promise<ITSMKbArticle> => {
    const response = await itsmAPIClient.patch(`/api/v1/itsm/kb/articles/${id}`, data);
    return response.data;
  },
  suggest: async (query: string): Promise<ITSMKbArticle[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/kb/suggest', { params: { query } });
    return response.data;
  },
  getCategories: async (): Promise<string[]> => {
    const response = await itsmAPIClient.get('/api/v1/itsm/kb/categories');
    return response.data;
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
  securityAPI,
  itsmTicketsAPI,
  itsmSlaAPI,
  itsmProblemsAPI,
  itsmChangesAPI,
  itsmKbAPI,
};
