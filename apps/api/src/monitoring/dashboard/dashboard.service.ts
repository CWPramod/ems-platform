// Dashboard Service
// Provides critical devices dashboard data and analytics
// apps/api/src/monitoring/dashboard/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { DeviceHealth } from '../../entities/device-health.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(DeviceHealth)
    private healthRepo: Repository<DeviceHealth>,
  ) {}

  /**
   * Get critical devices with health status
   */
  async getCriticalDevices(): Promise<any[]> {
    const criticalDevices = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.tier = :tier', { tier: 1 })
      .andWhere('a.monitoringEnabled = :enabled', { enabled: true })
      .orderBy('a.name', 'ASC')
      .getMany();

    // Get health data for each device
    const devicesWithHealth = await Promise.all(
      criticalDevices.map(async (device) => {
        const health = await this.healthRepo.findOne({
          where: { assetId: device.id },
        });

        return {
          id: device.id,
          name: device.name,
          type: device.type,
          ip: device.ip,
          location: device.location,
          vendor: device.vendor,
          model: device.model,
          status: device.status,
          tier: device.tier,
          health: health || this.getDefaultHealth(device.id),
        };
      })
    );

    return devicesWithHealth;
  }

  /**
   * Get critical devices summary statistics
   */
  async getCriticalDevicesSummary(): Promise<any> {
    const total = await this.assetRepo.count({
      where: { tier: 1, monitoringEnabled: true },
    });

    const byStatus = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('a.tier = :tier', { tier: 1 })
      .andWhere('a.monitoringEnabled = :enabled', { enabled: true })
      .groupBy('a.status')
      .getRawMany();

    // Get health statistics
    const healthStats = await this.healthRepo
      .createQueryBuilder('h')
      .select('AVG(h.healthScore)', 'avgHealthScore')
      .addSelect('AVG(h.cpuUtilization)', 'avgCpu')
      .addSelect('AVG(h.memoryUtilization)', 'avgMemory')
      .addSelect('SUM(h.activeAlertsCount)', 'totalActiveAlerts')
      .addSelect('SUM(h.criticalAlertsCount)', 'totalCriticalAlerts')
      .where('h.isCritical = :critical', { critical: true })
      .getRawOne();

    return {
      totalCritical: total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      healthMetrics: {
        averageHealthScore: parseFloat(healthStats?.avgHealthScore || '0'),
        averageCpuUtilization: parseFloat(healthStats?.avgCpu || '0'),
        averageMemoryUtilization: parseFloat(healthStats?.avgMemory || '0'),
        totalActiveAlerts: parseInt(healthStats?.totalActiveAlerts || '0'),
        totalCriticalAlerts: parseInt(healthStats?.totalCriticalAlerts || '0'),
      },
    };
  }

  /**
   * Get devices filtered by status
   */
  async getDevicesByStatus(status: string): Promise<any[]> {
    const devices = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status })
      .andWhere('a.monitoringEnabled = :enabled', { enabled: true })
      .orderBy('a.tier', 'ASC')
      .addOrderBy('a.name', 'ASC')
      .getMany();

    const devicesWithHealth = await Promise.all(
      devices.map(async (device) => {
        const health = await this.healthRepo.findOne({
          where: { assetId: device.id },
        });
        return {
          ...device,
          health: health || this.getDefaultHealth(device.id),
        };
      }),
    );

    return devicesWithHealth;
  }

  /**
   * Get device health details
   */
  async getDeviceHealth(assetId: string): Promise<any> {
    const device = await this.assetRepo.findOne({
      where: { id: assetId },
    });

    if (!device) {
      return null;
    }

    const health = await this.healthRepo.findOne({
      where: { assetId },
    });

    return {
      device,
      health: health || this.getDefaultHealth(assetId),
    };
  }

  /**
   * Get top devices by metric
   */
  async getTopDevicesByMetric(
    metric: 'cpu' | 'memory' | 'bandwidth' | 'alerts',
    limit: number = 10
  ): Promise<any[]> {
    let orderByField: string;
    let orderDirection: 'DESC' | 'ASC' = 'DESC';

    switch (metric) {
      case 'cpu':
        orderByField = 'h.cpuUtilization';
        break;
      case 'memory':
        orderByField = 'h.memoryUtilization';
        break;
      case 'bandwidth':
        orderByField = '(COALESCE(h.bandwidthInMbps, 0) + COALESCE(h.bandwidthOutMbps, 0))';
        break;
      case 'alerts':
        orderByField = 'h.activeAlertsCount';
        break;
      default:
        orderByField = 'h.healthScore';
        orderDirection = 'ASC'; // Lower health score = worse
    }

    const query = this.healthRepo
      .createQueryBuilder('h')
      .where('h.isCritical = :critical', { critical: true })
      .orderBy(orderByField, orderDirection)
      .addOrderBy('h.healthScore', 'ASC') // Secondary sort
      .limit(limit);

    const results = await query.getMany();

    // Get device details for each health record
    return Promise.all(
      results.map(async (health) => {
        const device = await this.assetRepo.findOne({
          where: { id: health.assetId },
        });

        return {
          device,
          assetId: health.assetId,
          metric: metric,
          value: this.getMetricValue(health, metric),
          health,
        };
      })
    );
  }

  /**
   * Get devices with active alerts
   */
  async getDevicesWithAlerts(): Promise<any[]> {
    const devicesWithAlerts = await this.healthRepo
      .createQueryBuilder('h')
      .where('h.activeAlertsCount > 0')
      .andWhere('h.isCritical = :critical', { critical: true })
      .orderBy('h.criticalAlertsCount', 'DESC')
      .addOrderBy('h.warningAlertsCount', 'DESC')
      .getMany();

    return Promise.all(
      devicesWithAlerts.map(async (health) => {
        const device = await this.assetRepo.findOne({
          where: { id: health.assetId },
        });

        return {
          device,
          alerts: {
            total: health.activeAlertsCount,
            critical: health.criticalAlertsCount,
            warning: health.warningAlertsCount,
          },
          health,
        };
      })
    );
  }

  /**
   * Get SLA compliance status
   */
  async getSLACompliance(): Promise<any> {
    const total = await this.healthRepo.count({
      where: { isCritical: true },
    });

    const compliant = await this.healthRepo.count({
      where: { isCritical: true, slaCompliance: true },
    });

    const nonCompliant = total - compliant;
    const compliancePercent = total > 0 ? (compliant / total) * 100 : 100;

    // Get devices with SLA issues
    const slaIssues = await this.healthRepo.find({
      where: { isCritical: true, slaCompliance: false },
      order: { uptimePercent30d: 'ASC' },
      take: 10,
    });

    return {
      total,
      compliant,
      nonCompliant,
      compliancePercent: parseFloat(compliancePercent.toFixed(2)),
      devicesWithIssues: await Promise.all(
        slaIssues.map(async (health) => {
          const device = await this.assetRepo.findOne({
            where: { id: health.assetId },
          });
          return { device, health };
        })
      ),
    };
  }

  /**
   * Update device health (used by monitoring system)
   */
  async updateDeviceHealth(assetId: string, healthData: Partial<DeviceHealth>): Promise<DeviceHealth> {
    let health = await this.healthRepo.findOne({
      where: { assetId },
    });

    if (!health) {
      // Create new health record
      health = this.healthRepo.create({
        assetId,
        ...healthData,
        lastHealthCheck: new Date(),
      });
    } else {
      // Update existing
      Object.assign(health, {
        ...healthData,
        lastHealthCheck: new Date(),
      });
    }

    // Calculate health score
    health.healthScore = this.calculateHealthScore(health);

    return this.healthRepo.save(health);
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(health: Partial<DeviceHealth>): number {
    let score = 100;

    // Deduct for high CPU
    if (health.cpuUtilization) {
      if (health.cpuUtilization > 90) score -= 30;
      else if (health.cpuUtilization > 75) score -= 15;
      else if (health.cpuUtilization > 60) score -= 5;
    }

    // Deduct for high memory
    if (health.memoryUtilization) {
      if (health.memoryUtilization > 90) score -= 30;
      else if (health.memoryUtilization > 75) score -= 15;
      else if (health.memoryUtilization > 60) score -= 5;
    }

    // Deduct for packet loss
    if (health.packetLossPercent) {
      if (health.packetLossPercent > 5) score -= 20;
      else if (health.packetLossPercent > 2) score -= 10;
      else if (health.packetLossPercent > 1) score -= 5;
    }

    // Deduct for active alerts
    if (health.criticalAlertsCount) {
      score -= health.criticalAlertsCount * 10;
    }
    if (health.warningAlertsCount) {
      score -= health.warningAlertsCount * 5;
    }

    // Deduct for down interfaces
    if (health.interfacesDown && health.totalInterfaces) {
      const downPercent = (health.interfacesDown / health.totalInterfaces) * 100;
      if (downPercent > 50) score -= 20;
      else if (downPercent > 25) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get default health object for devices without health data
   */
  private getDefaultHealth(assetId: string): Partial<DeviceHealth> {
    return {
      assetId,
      status: 'unknown',
      healthScore: 0,
      isCritical: false,
      activeAlertsCount: 0,
      criticalAlertsCount: 0,
      warningAlertsCount: 0,
    };
  }

  /**
   * Get metric value from health object
   */
  private getMetricValue(health: DeviceHealth, metric: string): number {
    switch (metric) {
      case 'cpu':
        return health.cpuUtilization || 0;
      case 'memory':
        return health.memoryUtilization || 0;
      case 'bandwidth':
        return (health.bandwidthInMbps || 0) + (health.bandwidthOutMbps || 0);
      case 'alerts':
        return health.activeAlertsCount || 0;
      default:
        return 0;
    }
  }
}
