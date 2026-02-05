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
      (config: any) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
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

  async getTopSourceIPs(limit: number = 10, timeRange: string = '1h') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers/source-ips?limit=${limit}&timeRange=${timeRange}`
    );
    return response.data;
  }

  async getTopDestinationIPs(limit: number = 10, timeRange: string = '1h') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers/destination-ips?limit=${limit}&timeRange=${timeRange}`
    );
    return response.data;
  }

  async getTopApplications(limit: number = 10, timeRange: string = '1h') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers/applications?limit=${limit}&timeRange=${timeRange}`
    );
    return response.data;
  }

  async getTopConversations(limit: number = 10, timeRange: string = '1h') {
    const response = await this.api.get(
      `/api/v1/monitoring/top-talkers/conversations?limit=${limit}&timeRange=${timeRange}`
    );
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

  // Dashboard - Devices by Status
  async getDevicesByStatus(status: string) {
    const response = await this.api.get(`/api/v1/monitoring/dashboard/devices-by-status?status=${status}`);
    return response.data;
  }

  // Masters — Devices APIs
  async getDevices(filters?: { type?: string; location?: string; vendor?: string; tier?: number; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.location) params.append('location', filters.location);
    if (filters?.vendor) params.append('vendor', filters.vendor);
    if (filters?.tier) params.append('tier', filters.tier.toString());
    if (filters?.search) params.append('search', filters.search);
    const response = await this.api.get(`/api/v1/masters/devices?${params.toString()}`);
    return response.data;
  }

  async getDeviceStats() {
    const response = await this.api.get('/api/v1/masters/devices/stats/overview');
    return response.data;
  }

  async createDevice(data: any) {
    const response = await this.api.post('/api/v1/masters/devices', data);
    return response.data;
  }

  async updateDevice(id: string, data: any) {
    const response = await this.api.put(`/api/v1/masters/devices/${id}`, data);
    return response.data;
  }

  async deleteDevice(id: string) {
    const response = await this.api.delete(`/api/v1/masters/devices/${id}`);
    return response.data;
  }

  async toggleDeviceMonitoring(id: string, enabled: boolean) {
    const response = await this.api.post(`/api/v1/masters/devices/${id}/toggle-monitoring`, { enabled });
    return response.data;
  }

  async bulkUploadDevices(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post('/api/v1/masters/devices/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Masters — Customers APIs
  async getCustomers(filters?: { customerType?: string; isActive?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.customerType) params.append('customer_type', filters.customerType);
    if (filters?.isActive) params.append('is_active', filters.isActive);
    if (filters?.search) params.append('search', filters.search);
    const response = await this.api.get(`/api/v1/masters/customers?${params.toString()}`);
    return response.data;
  }

  async getCustomerStats() {
    const response = await this.api.get('/api/v1/masters/customers/stats/overview');
    return response.data;
  }

  async createCustomer(data: any) {
    const response = await this.api.post('/api/v1/masters/customers', data);
    return response.data;
  }

  async updateCustomer(id: number, data: any) {
    const response = await this.api.put(`/api/v1/masters/customers/${id}`, data);
    return response.data;
  }

  async deleteCustomer(id: number) {
    const response = await this.api.delete(`/api/v1/masters/customers/${id}`);
    return response.data;
  }

  async getHeadOffices() {
    const response = await this.api.get('/api/v1/masters/customers/list/head-offices');
    return response.data;
  }

  // Masters — Thresholds APIs
  async getThresholds() {
    const response = await this.api.get('/api/v1/masters/thresholds');
    return response.data;
  }

  // Reports — Performance & Traffic
  async generatePerformanceReport(params: {
    startDate: string;
    endDate: string;
    tier?: number;
    location?: string;
    deviceType?: string;
  }) {
    const response = await this.api.post('/api/v1/reporting/reports/performance', params);
    return response.data;
  }

  async generateTrafficReport(params: {
    startDate: string;
    endDate: string;
    tier?: number;
    location?: string;
    deviceType?: string;
  }) {
    const response = await this.api.post('/api/v1/reporting/reports/traffic', params);
    return response.data;
  }

  // Discovery — Network Scan APIs
  async startNetworkScan(params: {
    startIp: string;
    endIp: string;
    subnet?: string;
    snmpCommunity?: string;
    timeout?: number;
  }) {
    const response = await this.api.post('/api/v1/masters/discovery/scan', params);
    return response.data;
  }

  async getScanStatus(scanId: string) {
    const response = await this.api.get(`/api/v1/masters/discovery/scan/${scanId}/status`);
    return response.data;
  }

  async getScanResults(scanId: string) {
    const response = await this.api.get(`/api/v1/masters/discovery/scan/${scanId}/results`);
    return response.data;
  }

  async importDiscoveredDevices(scanId: string, data: {
    deviceIPs: string[];
    tier?: number;
    location?: string;
    customerId?: number;
  }) {
    const response = await this.api.post(`/api/v1/masters/discovery/scan/${scanId}/import`, data);
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
