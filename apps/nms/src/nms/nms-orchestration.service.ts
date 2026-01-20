import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmsCoreClient, Asset, Event, Metric } from '../ems-core/ems-core.client';
import { SnmpPollingService } from '../snmp/snmp-polling.service';

interface DeviceStatus {
  assetId: string;
  lastPollTime: Date;
  lastSuccessTime?: Date;
  consecutiveFailures: number;
  isReachable: boolean;
  lastError?: string;
}

@Injectable()
export class NmsOrchestrationService implements OnModuleInit {
  private readonly logger = new Logger(NmsOrchestrationService.name);
  private deviceStatuses = new Map<string, DeviceStatus>();
  private isPolling = false;

  constructor(
    private readonly emsCoreClient: EmsCoreClient,
    private readonly snmpService: SnmpPollingService,
  ) {}

  async onModuleInit() {
    this.logger.log('NMS Orchestration Service initialized');
    
    // Check EMS Core connectivity
    const isHealthy = await this.emsCoreClient.healthCheck();
    if (isHealthy) {
      this.logger.log('✅ EMS Core is reachable at ' + this.emsCoreClient.getCoreUrl());
    } else {
      this.logger.warn('⚠️  EMS Core is not reachable. Will retry during polling.');
    }

    // Initial poll after startup (delayed by 10 seconds)
    setTimeout(() => {
      this.pollAllDevices().catch((err) =>
        this.logger.error(`Initial poll failed: ${err.message}`),
      );
    }, 10000);
  }

  /**
   * Main polling job - runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledPoll() {
    await this.pollAllDevices();
  }

  /**
   * Metric collection job - runs every 1 minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledMetricCollection() {
    await this.collectMetricsFromAllDevices();
  }

  /**
   * Poll all network devices
   */
  async pollAllDevices(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('Polling already in progress, skipping...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting device polling cycle...');

      // Fetch network assets from EMS Core
      const assets = await this.emsCoreClient.getNetworkAssets();
      
      if (assets.length === 0) {
        this.logger.warn('No network assets found to poll');
        return;
      }

      this.logger.log(`Polling ${assets.length} network devices...`);

      // Poll each device
      const pollPromises = assets.map((asset) => this.pollSingleDevice(asset));
      const results = await Promise.allSettled(pollPromises);

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.filter((r) => r.status === 'rejected').length;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Polling cycle complete: ${successes} successful, ${failures} failed (${duration}ms)`,
      );
    } catch (error: any) {
      this.logger.error(`Polling cycle failed: ${error.message}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single device
   */
  private async pollSingleDevice(asset: Asset): Promise<void> {
    const { id, name, ipAddress, metadata } = asset;

    if (!ipAddress) {
      this.logger.warn(`Asset ${name} has no IP address, skipping`);
      return;
    }

    const community = metadata?.snmpCommunity || 'public';
    const version = metadata?.snmpVersion || '2c';
    const port = metadata?.snmpPort || 161;

    let status = this.deviceStatuses.get(id);
    if (!status) {
      status = {
        assetId: id,
        lastPollTime: new Date(),
        consecutiveFailures: 0,
        isReachable: false,
      };
      this.deviceStatuses.set(id, status);
    }

    status.lastPollTime = new Date();

    try {
      // Test connectivity
      const isReachable = await this.snmpService.testConnection(
        ipAddress,
        community,
        version,
        port,
      );

      if (isReachable) {
        // Device is up
        if (!status.isReachable) {
          // Device came back online
          this.logger.log(`Device ${name} is now reachable`);
          
          await this.emsCoreClient.createEvent({
            source: 'nms',
            severity: 'info',
            title: 'Device Online',
            description: `Device ${name} is now reachable via SNMP`,
            assetId: id,
            metadata: {
              ipAddress,
              previousStatus: 'unreachable',
              currentStatus: 'reachable',
            },
          });
        }

        status.isReachable = true;
        status.lastSuccessTime = new Date();
        status.consecutiveFailures = 0;

        // Collect device info and update asset metadata
        try {
          const deviceInfo = await this.snmpService.pollDevice(
            ipAddress,
            community,
            version,
            port,
          );

          // Update asset metadata in EMS Core
          await this.emsCoreClient.updateAssetMetadata(id, {
            ...metadata,
            manufacturer: deviceInfo.manufacturer,
            model: deviceInfo.model,
            sysName: deviceInfo.sysName,
            sysLocation: deviceInfo.sysLocation,
            lastPolled: new Date().toISOString(),
          });
        } catch (err: any) {
          this.logger.warn(`Failed to collect device info for ${name}: ${err.message}`);
        }
      } else {
        // Device is down
        status.consecutiveFailures++;
        
        if (status.isReachable) {
          // Device just went down
          this.logger.error(`Device ${name} is unreachable (${ipAddress})`);
          
          await this.emsCoreClient.createEvent({
            source: 'nms',
            severity: 'critical',
            title: 'Device Unreachable',
            description: `Device ${name} is not responding to SNMP requests`,
            assetId: id,
            metadata: {
              ipAddress,
              community: community !== 'public' ? '***' : community,
              consecutiveFailures: status.consecutiveFailures,
            },
          });
        } else if (status.consecutiveFailures === 3 || status.consecutiveFailures === 10) {
          // Send periodic reminders
          await this.emsCoreClient.createEvent({
            source: 'nms',
            severity: 'critical',
            title: 'Device Still Unreachable',
            description: `Device ${name} has been unreachable for ${status.consecutiveFailures} consecutive polls`,
            assetId: id,
            metadata: {
              ipAddress,
              consecutiveFailures: status.consecutiveFailures,
            },
          });
        }

        status.isReachable = false;
      }
    } catch (error: any) {
      status.consecutiveFailures++;
      status.lastError = error.message;
      this.logger.error(`Error polling ${name}: ${error.message}`);
    }
  }

  /**
   * Collect metrics from all reachable devices
   */
  private async collectMetricsFromAllDevices(): Promise<void> {
    const reachableDevices = Array.from(this.deviceStatuses.values()).filter(
      (s) => s.isReachable,
    );

    if (reachableDevices.length === 0) {
      return;
    }

    this.logger.debug(`Collecting metrics from ${reachableDevices.length} devices...`);

    const assets = await this.emsCoreClient.getNetworkAssets();
    const metrics: Metric[] = [];

    for (const status of reachableDevices) {
      const asset = assets.find((a) => a.id === status.assetId);
      if (!asset || !asset.ipAddress) continue;

      try {
        const deviceMetrics = await this.snmpService.collectMetrics(
          asset.ipAddress,
          asset.metadata?.snmpCommunity || 'public',
          asset.metadata?.snmpVersion || '2c',
          asset.metadata?.snmpPort || 161,
        );

        // Add metrics for this device
        if (deviceMetrics.cpuUsage !== undefined) {
          metrics.push({
            assetId: asset.id,
            metricName: 'cpu_usage',
            value: deviceMetrics.cpuUsage,
            unit: 'percent',
            tags: { device: asset.name },
          });

          // Check CPU threshold (80%)
          if (deviceMetrics.cpuUsage > 80) {
            await this.emsCoreClient.createEvent({
              source: 'nms',
              severity: 'warning',
              title: 'High CPU Usage',
              description: `Device ${asset.name} CPU usage is ${deviceMetrics.cpuUsage.toFixed(1)}%`,
              assetId: asset.id,
              metadata: {
                cpuUsage: deviceMetrics.cpuUsage,
                threshold: 80,
              },
            });
          }
        }

        if (deviceMetrics.memoryUsage !== undefined) {
          metrics.push({
            assetId: asset.id,
            metricName: 'memory_usage',
            value: deviceMetrics.memoryUsage,
            unit: 'percent',
            tags: { device: asset.name },
          });

          // Check memory threshold (85%)
          if (deviceMetrics.memoryUsage > 85) {
            await this.emsCoreClient.createEvent({
              source: 'nms',
              severity: 'warning',
              title: 'High Memory Usage',
              description: `Device ${asset.name} memory usage is ${deviceMetrics.memoryUsage.toFixed(1)}%`,
              assetId: asset.id,
              metadata: {
                memoryUsage: deviceMetrics.memoryUsage,
                threshold: 85,
              },
            });
          }
        }

        metrics.push({
          assetId: asset.id,
          metricName: 'uptime',
          value: deviceMetrics.uptimeSeconds,
          unit: 'seconds',
          tags: { device: asset.name },
        });

        if (deviceMetrics.interfaceCount !== undefined) {
          metrics.push({
            assetId: asset.id,
            metricName: 'interface_count',
            value: deviceMetrics.interfaceCount,
            unit: 'count',
            tags: { device: asset.name },
          });
        }
      } catch (error: any) {
        this.logger.warn(`Failed to collect metrics for ${asset.name}: ${error.message}`);
      }
    }

    // Send all metrics to EMS Core
    if (metrics.length > 0) {
      await this.emsCoreClient.sendMetrics(metrics);
      this.logger.debug(`Sent ${metrics.length} metrics to EMS Core`);
    }
  }

  /**
   * Manually trigger device discovery
   */
  async triggerDiscovery(): Promise<void> {
    this.logger.log('Manual discovery triggered');
    await this.pollAllDevices();
  }

  /**
   * Get current NMS status
   */
  getStatus() {
    const devices = Array.from(this.deviceStatuses.values());
    
    return {
      isPolling: this.isPolling,
      totalDevices: devices.length,
      reachableDevices: devices.filter((d) => d.isReachable).length,
      unreachableDevices: devices.filter((d) => !d.isReachable).length,
      emsCoreUrl: this.emsCoreClient.getCoreUrl(),
      devices: devices.map((d) => ({
        assetId: d.assetId,
        isReachable: d.isReachable,
        lastPollTime: d.lastPollTime,
        lastSuccessTime: d.lastSuccessTime,
        consecutiveFailures: d.consecutiveFailures,
      })),
    };
  }
}
