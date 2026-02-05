// API Service
// Centralized API calls with authentication
// apps/web/src/services/apiService.ts

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';

class ApiService {
  private api: any;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to attach token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Dashboard APIs
  async getCriticalDevices() {
    const response = await this.api.get('/api/v1/monitoring/dashboard/critical-devices');
    return response.data;
  }

  async getDashboardSummary() {
    const response = await this.api.get('/api/v1/monitoring/dashboard/summary');
    return response.data;
  }

  async getDeviceHealth(deviceId: string) {
    const response = await this.api.get(`/api/v1/monitoring/dashboard/device/${deviceId}/health`);
    return response.data;
  }

  async getTopDevicesByMetric(metric: string, limit: number = 5) {
    const response = await this.api.get(`/api/v1/monitoring/dashboard/top-devices?metric=${metric}&limit=${limit}`);
    return response.data;
  }

  async getSLACompliance() {
    const response = await this.api.get('/api/v1/monitoring/dashboard/sla-compliance');
    return response.data;
  }

  // Drilldown APIs
  async getDeviceOverview(deviceId: string) {
    const response = await this.api.get(`/api/v1/monitoring/drilldown/device/${deviceId}/overview`);
    return response.data;
  }

  async getPerformanceHistory(deviceId: string, metricType: string, timeRange: string = '24h') {
    const response = await this.api.get(
      `/api/v1/monitoring/drilldown/device/${deviceId}/history/${metricType}?timeRange=${timeRange}`
    );
    return response.data;
  }

  async getMetricsTrend(deviceId: string, metrics: string[], timeRange: string = '24h') {
    const metricsParam = metrics.join(',');
    const response = await this.api.get(
      `/api/v1/monitoring/drilldown/device/${deviceId}/trends?metrics=${metricsParam}&timeRange=${timeRange}`
    );
    return response.data;
  }

  async getPerformanceSummary(deviceId: string) {
    const response = await this.api.get(`/api/v1/monitoring/drilldown/device/${deviceId}/performance-summary`);
    return response.data;
  }

  // Topology APIs
  async getNetworkTopology(filters?: { tier?: number; location?: string; deviceType?: string }) {
    const params = new URLSearchParams();
    if (filters?.tier) params.append('tier', filters.tier.toString());
    if (filters?.location) params.append('location', filters.location);
    if (filters?.deviceType) params.append('deviceType', filters.deviceType);

    const response = await this.api.get(`/api/v1/monitoring/topology/network?${params.toString()}`);
    return response.data;
  }

  async getTopologyStats() {
    const response = await this.api.get('/api/v1/monitoring/topology/stats');
    return response.data;
  }

  // Top Talkers APIs
  async getTopTalkers(limit: number = 10, timeRange: string = '1h', metric: string = 'bytes') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers?limit=${limit}&timeRange=${timeRange}&metric=${metric}`
    );
    return response.data;
  }

  async getTopProtocols(limit: number = 5, timeRange: string = '24h') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers/protocols?limit=${limit}&timeRange=${timeRange}`
    );
    return response.data;
  }

  async getTrafficStats(timeRange: string = '24h') {
    const response = await this.api.get(`/api/v1/monitoring/top-talkers/stats/overview?timeRange=${timeRange}`);
    return response.data;
  }

  // Reports APIs
  async generateSLAReport(params: {
    startDate: string;
    endDate: string;
    tier?: number;
    location?: string;
  }) {
    const response = await this.api.post('/api/v1/reporting/reports/sla', params);
    return response.data;
  }

  async generateUptimeReport(params: {
    startDate: string;
    endDate: string;
    tier?: number;
    location?: string;
  }) {
    const response = await this.api.post('/api/v1/reporting/reports/uptime', params);
    return response.data;
  }

  async getReportHistory(limit: number = 50) {
    const response = await this.api.get(`/api/v1/reporting/reports/history?limit=${limit}`);
    return response.data;
  }

  // Custom Dashboards APIs
  async getCustomDashboards() {
    const response = await this.api.get('/api/v1/reporting/dashboards');
    return response.data;
  }

  async getCustomDashboard(id: number) {
    const response = await this.api.get(`/api/v1/reporting/dashboards/${id}`);
    return response.data;
  }
}

export const apiService = new ApiService();
