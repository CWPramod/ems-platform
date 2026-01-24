// Drill-down Service
// Provides detailed device views with performance metrics and history
// apps/api/src/monitoring/drilldown/drilldown.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { DeviceHealth } from '../../entities/device-health.entity';
import { DeviceInterface } from '../../entities/device-interface.entity';
import { DeviceMetricsHistory } from '../../entities/device-metrics-history.entity';

@Injectable()
export class DrilldownService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(DeviceHealth)
    private healthRepo: Repository<DeviceHealth>,
    @InjectRepository(DeviceInterface)
    private interfaceRepo: Repository<DeviceInterface>,
    @InjectRepository(DeviceMetricsHistory)
    private metricsHistoryRepo: Repository<DeviceMetricsHistory>,
  ) {}

  /**
   * Get complete device overview
   */
  async getDeviceOverview(assetId: string): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const health = await this.healthRepo.findOne({
      where: { assetId },
    });

    const interfaces = await this.interfaceRepo.find({
      where: { assetId },
    });

    const interfacesUp = interfaces.filter(i => i.operationalStatus === 'up').length;
    const interfacesDown = interfaces.filter(i => i.operationalStatus === 'down').length;

    // Get latest metrics (last 5 minutes)
    const latestMetrics = await this.getLatestMetrics(assetId);

    return {
      device,
      health,
      interfaces: {
        total: interfaces.length,
        up: interfacesUp,
        down: interfacesDown,
        list: interfaces,
      },
      latestMetrics,
      summary: {
        status: device.status,
        healthScore: health?.healthScore || 0,
        tier: device.tier,
        monitoringEnabled: device.monitoringEnabled,
        lastSeen: health?.lastSeen,
      },
    };
  }

  /**
   * Get performance history for a device
   */
  async getPerformanceHistory(
    assetId: string,
    metricType: string,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const startTime = this.getStartTime(timeRange);

    const metrics = await this.metricsHistoryRepo.find({
      where: {
        assetId,
        metricType,
        timestamp: MoreThanOrEqual(startTime),
      },
      order: {
        timestamp: 'ASC',
      },
    });

    // Calculate statistics
    const values = metrics.map(m => m.value);
    const stats = this.calculateStats(values);

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
      },
      metricType,
      timeRange,
      dataPoints: metrics.length,
      statistics: stats,
      data: metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.value,
        unit: m.unit,
      })),
    };
  }

  /**
   * Get metrics trend comparison
   */
  async getMetricsTrend(
    assetId: string,
    metricTypes: string[],
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const startTime = this.getStartTime(timeRange);

    const trends = await Promise.all(
      metricTypes.map(async (metricType) => {
        const metrics = await this.metricsHistoryRepo.find({
          where: {
            assetId,
            metricType,
            timestamp: MoreThanOrEqual(startTime),
          },
          order: {
            timestamp: 'ASC',
          },
        });

        const values = metrics.map(m => m.value);
        const stats = this.calculateStats(values);

        return {
          metricType,
          statistics: stats,
          dataPoints: metrics.length,
          latestValue: values[values.length - 1] || 0,
          trend: this.calculateTrend(values),
        };
      })
    );

    return {
      device: {
        id: device.id,
        name: device.name,
      },
      timeRange,
      trends,
    };
  }

  /**
   * Get interface details with metrics
   */
  async getInterfaceDetails(interfaceId: number): Promise<any> {
    const interface_ = await this.interfaceRepo.findOne({
      where: { id: interfaceId },
    });

    if (!interface_) {
      throw new NotFoundException('Interface not found');
    }

    const device = await this.assetRepo.findOne({
      where: { id: interface_.assetId },
    });

    // Get recent metrics for this interface
    const recentMetrics = await this.metricsHistoryRepo.find({
      where: {
        assetId: interface_.assetId,
        timestamp: MoreThanOrEqual(new Date(Date.now() - 3600000)), // Last hour
      },
      order: {
        timestamp: 'DESC',
      },
      take: 100,
    });

    return {
      interface: interface_,
      device: {
        id: device?.id,
        name: device?.name,
        type: device?.type,
      },
      status: {
        operational: interface_.operationalStatus,
        admin: interface_.adminStatus,
        lastSeen: interface_.lastSeen,
      },
      configuration: {
        ipAddress: interface_.ipAddress,
        subnetMask: interface_.subnetMask,
        macAddress: interface_.macAddress,
        vlanId: interface_.vlanId,
        speed: interface_.speedMbps,
        duplex: interface_.duplex,
        mtu: interface_.mtu,
      },
      monitoring: {
        isMonitored: interface_.isMonitored,
        monitorBandwidth: interface_.monitorBandwidth,
        monitorErrors: interface_.monitorErrors,
      },
      recentMetrics: recentMetrics.slice(0, 20),
    };
  }

  /**
   * Get all interfaces for a device with stats
   */
  async getDeviceInterfaces(assetId: string): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const interfaces = await this.interfaceRepo.find({
      where: { assetId },
      order: { interfaceName: 'ASC' },
    });

    // Group by status
    const byStatus = {
      up: interfaces.filter(i => i.operationalStatus === 'up'),
      down: interfaces.filter(i => i.operationalStatus === 'down'),
      unknown: interfaces.filter(i => i.operationalStatus !== 'up' && i.operationalStatus !== 'down'),
    };

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
      },
      summary: {
        total: interfaces.length,
        up: byStatus.up.length,
        down: byStatus.down.length,
        unknown: byStatus.unknown.length,
        monitored: interfaces.filter(i => i.isMonitored).length,
      },
      interfaces: interfaces,
      byStatus,
    };
  }

  /**
   * Get performance summary across time ranges
   */
  async getPerformanceSummary(assetId: string): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const timeRanges = ['1h', '24h', '7d', '30d'] as const;
    const metricTypes = ['cpu', 'memory', 'bandwidth_in', 'bandwidth_out'];

    const summaries = await Promise.all(
      timeRanges.map(async (range) => {
        const startTime = this.getStartTime(range);
        
        const metrics = await Promise.all(
          metricTypes.map(async (type) => {
            const data = await this.metricsHistoryRepo.find({
              where: {
                assetId,
                metricType: type,
                timestamp: MoreThanOrEqual(startTime),
              },
            });

            const values = data.map(m => m.value);
            return {
              type,
              avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
              max: values.length > 0 ? Math.max(...values) : 0,
              min: values.length > 0 ? Math.min(...values) : 0,
            };
          })
        );

        return {
          timeRange: range,
          metrics: metrics.reduce((acc, m) => {
            acc[m.type] = { avg: m.avg, max: m.max, min: m.min };
            return acc;
          }, {}),
        };
      })
    );

    return {
      device: {
        id: device.id,
        name: device.name,
      },
      summaries,
    };
  }

  /**
   * Get latest metrics for all types
   */
  private async getLatestMetrics(assetId: string): Promise<any> {
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    
    const metrics = await this.metricsHistoryRepo.find({
      where: {
        assetId,
        timestamp: MoreThanOrEqual(fiveMinutesAgo),
      },
      order: {
        timestamp: 'DESC',
      },
    });

    // Group by metric type and get latest
    const latestByType = {};
    metrics.forEach(m => {
      if (!latestByType[m.metricType] || m.timestamp > latestByType[m.metricType].timestamp) {
        latestByType[m.metricType] = m;
      }
    });

    return latestByType;
  }

  /**
   * Calculate statistics from values array
   */
  private calculateStats(values: number[]): any {
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      count: values.length,
    };
  }

  /**
   * Calculate trend (increasing/decreasing/stable)
   */
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Get start time based on time range
   */
  private getStartTime(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 3600000);
      case '24h':
        return new Date(now.getTime() - 86400000);
      case '7d':
        return new Date(now.getTime() - 604800000);
      case '30d':
        return new Date(now.getTime() - 2592000000);
      default:
        return new Date(now.getTime() - 86400000);
    }
  }
}
