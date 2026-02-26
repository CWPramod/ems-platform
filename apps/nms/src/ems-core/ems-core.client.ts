import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface Asset {
  id: string;
  name: string;
  type: string; // Changed from enum to string to accept any type
  ip?: string;
  ipAddress?: string;
  status: string; // Changed to string to accept any status
  metadata?: {
    snmpCommunity?: string;
    snmpVersion?: string;
    snmpPort?: number;
    deviceType?: string;
    manufacturer?: string;
    model?: string;
    location?: string;
    [key: string]: any;
  };
}

export interface CreateAssetPayload {
  name: string;
  type: string;
  ip: string;
  vendor?: string;
  model?: string;
  location?: string;
  tier?: string;
  owner?: string;
  status?: string;
  monitoringEnabled?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface DeviceInterfacePayload {
  interfaceName: string;
  interfaceIndex: number;
  interfaceType: number;
  speedMbps: number;
  operationalStatus: string;
  adminStatus: string;
}

export interface Event {
  source: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description?: string;
  assetId: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface Metric {
  assetId: string;
  metricName: string;
  value: number;
  unit?: string;
  timestamp?: string;
  tags?: Record<string, string>;
}

@Injectable()
export class EmsCoreClient {
  private readonly logger = new Logger(EmsCoreClient.name);
  private readonly client: AxiosInstance;
  private readonly coreApiUrl: string;
  private authToken?: string;

  // Network device types that NMS should monitor
  private readonly NETWORK_DEVICE_TYPES = [
    'network_device',
    'router',
    'switch',
    'firewall',
    'access_point',
    'load_balancer',
  ];

  // Valid status values for monitoring
  private readonly VALID_STATUSES = ['active', 'online'];

  constructor() {
    this.coreApiUrl = process.env.EMS_CORE_URL || 'http://localhost:3100';
    
    this.client = axios.create({
      baseURL: this.coreApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests if available
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    this.logger.log(`EMS Core client initialized: ${this.coreApiUrl}`);
    this.logger.log(`Monitoring device types: ${this.NETWORK_DEVICE_TYPES.join(', ')}`);
    this.logger.log(`Valid status values: ${this.VALID_STATUSES.join(', ')}`);
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    this.logger.log('Auth token set for EMS Core communication');
  }

  /**
   * Fetch all network assets that NMS should monitor
   */
  async getNetworkAssets(): Promise<Asset[]> {
    try {
      // Fetch ALL assets without parameters to avoid 500 error
      const response = await this.client.get('/assets');

      // Handle different response formats
      let assets: any[];
      
      if (Array.isArray(response.data)) {
        // Response is a plain array
        assets = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // Response is { data: [...] }
        assets = response.data.data;
      } else if (response.data.assets && Array.isArray(response.data.assets)) {
        // Response is { assets: [...] }
        assets = response.data.assets;
      } else {
        // Single object or unknown format
        this.logger.warn('Unexpected response format from /assets endpoint');
        this.logger.debug(`Response: ${JSON.stringify(response.data)}`);
        return [];
      }

      // Map 'ip' field to 'ipAddress' if needed
      assets = assets.map((asset: any) => ({
        ...asset,
        ipAddress: asset.ipAddress || asset.ip, // Handle both field names
      }));

      // Filter for network devices with valid status
      const networkAssets = assets.filter(
        (asset: any) => 
          this.NETWORK_DEVICE_TYPES.includes(asset.type) && 
          this.VALID_STATUSES.includes(asset.status) &&
          asset.ipAddress // Must have IP address to monitor
      );

      this.logger.log(`Fetched ${networkAssets.length} network assets from EMS Core (out of ${assets.length} total)`);
      
      if (networkAssets.length > 0) {
        this.logger.log(`Found devices: ${networkAssets.map(a => `${a.name} (${a.type})`).join(', ')}`);
      }
      
      return networkAssets;
    } catch (error: any) {
      this.logger.error(`Failed to fetch assets from EMS Core: ${error.message}`);
      
      // Return empty array if EMS Core is not available (graceful degradation)
      if (error.code === 'ECONNREFUSED') {
        this.logger.warn('EMS Core is not available. NMS will retry...');
        return [];
      }
      
      // Log more details for debugging
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      
      // Return empty array instead of throwing to keep polling running
      return [];
    }
  }

  /**
   * Get a specific asset by ID
   */
  async getAsset(assetId: string): Promise<Asset | null> {
    try {
      const response = await this.client.get(`/assets/${assetId}`);
      
      // Map 'ip' to 'ipAddress' if needed
      const asset = response.data;
      return {
        ...asset,
        ipAddress: asset.ipAddress || asset.ip,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to fetch asset ${assetId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create an event in EMS Core (when device issues detected)
   */
  async createEvent(event: Event): Promise<void> {
    try {
      const eventData = {
        ...event,
        source: 'nms',
        timestamp: event.timestamp || new Date().toISOString(),
      };

      await this.client.post('/events', eventData);
      
      this.logger.log(
        `Event created in EMS Core: ${event.severity} - ${event.title} (asset: ${event.assetId})`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to create event in EMS Core: ${error.message}`);
      
      // Don't throw - we don't want to stop polling if event creation fails
      if (error.response?.data) {
        this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  /**
   * Send metrics to EMS Core
   */
  async sendMetrics(metrics: Metric[]): Promise<void> {
    try {
      // Send metrics one by one
      for (const metric of metrics) {
        await this.client.post('/metrics', {
          assetId: metric.assetId,
          name: metric.metricName,
          value: metric.value,
          unit: metric.unit || 'count',
          timestamp: metric.timestamp || new Date().toISOString(),
          tags: metric.tags || {},
        });
      }

      this.logger.debug(`Sent ${metrics.length} metrics to EMS Core`);
    } catch (error: any) {
      this.logger.error(`Failed to send metrics to EMS Core: ${error.message}`);
    }
  }

  /**
   * Update asset metadata (e.g., discovered device info)
   */
  async updateAssetMetadata(
    assetId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await this.client.patch(`/assets/${assetId}`, {
        metadata,
      });

      this.logger.debug(`Updated metadata for asset ${assetId}`);
    } catch (error: any) {
      this.logger.error(`Failed to update asset metadata: ${error.message}`);
    }
  }

  /**
   * Create a new asset in EMS Core
   */
  async createAsset(data: CreateAssetPayload): Promise<Asset> {
    try {
      const response = await this.client.post('/assets', data);
      const asset = response.data;

      this.logger.log(`Created asset in EMS Core: ${asset.name} (${asset.id})`);

      return {
        ...asset,
        ipAddress: asset.ipAddress || asset.ip,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create asset in EMS Core: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Create interfaces for a device asset
   */
  async createDeviceInterfaces(
    assetId: string,
    interfaces: DeviceInterfacePayload[],
  ): Promise<void> {
    try {
      await this.client.post(
        `/api/v1/masters/devices/${assetId}/interfaces`,
        { interfaces },
      );

      this.logger.log(
        `Created ${interfaces.length} interfaces for asset ${assetId}`,
      );
    } catch (error: any) {
      // If the endpoint doesn't exist, store interfaces as asset metadata instead
      if (error.response?.status === 404) {
        this.logger.warn(
          `Interface endpoint not available, storing as asset metadata for ${assetId}`,
        );
        await this.updateAssetMetadata(assetId, {
          discoveredInterfaces: interfaces,
        });
        return;
      }
      this.logger.error(
        `Failed to create interfaces for asset ${assetId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Find an existing asset by IP address
   */
  async findAssetByIp(ip: string): Promise<Asset | null> {
    try {
      const response = await this.client.get('/assets');

      let assets: any[];

      if (Array.isArray(response.data)) {
        assets = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        assets = response.data.data;
      } else if (response.data.assets && Array.isArray(response.data.assets)) {
        assets = response.data.assets;
      } else {
        return null;
      }

      const match = assets.find(
        (a: any) => a.ip === ip || a.ipAddress === ip,
      );

      if (match) {
        return {
          ...match,
          ipAddress: match.ipAddress || match.ip,
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to search for asset by IP ${ip}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if EMS Core is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try fetching assets as a health check since /health might not exist
      const response = await this.client.get('/assets', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get EMS Core URL
   */
  getCoreUrl(): string {
    return this.coreApiUrl;
  }
}
