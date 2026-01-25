// Reports Service
// Generates SLA, uptime, and performance reports
// apps/api/src/reporting/reports/reports.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { DeviceHealth } from '../../entities/device-health.entity';
import { DeviceMetricsHistory } from '../../entities/device-metrics-history.entity';
import { ReportDefinition } from '../../entities/report-definition.entity';
import { ReportHistory } from '../../entities/report-history.entity';

interface ReportParams {
  startDate: Date;
  endDate: Date;
  assetIds?: string[];
  tier?: number;
  location?: string;
  deviceType?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(DeviceHealth)
    private healthRepo: Repository<DeviceHealth>,
    @InjectRepository(DeviceMetricsHistory)
    private metricsRepo: Repository<DeviceMetricsHistory>,
    @InjectRepository(ReportDefinition)
    private reportDefRepo: Repository<ReportDefinition>,
    @InjectRepository(ReportHistory)
    private reportHistoryRepo: Repository<ReportHistory>,
  ) {}

  /**
   * Generate SLA Report
   */
  async generateSLAReport(params: ReportParams): Promise<any> {
    const startTime = new Date();
    
    // Get devices based on filters
    const devices = await this.getFilteredDevices(params);

    // Calculate SLA for each device
    const slaData = await Promise.all(
      devices.map(async (device) => {
        const health = await this.healthRepo.findOne({
          where: { assetId: device.id },
        });

        return {
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          location: device.location,
          tier: device.tier,
          uptime24h: health?.uptimePercent24h || 0,
          uptime7d: health?.uptimePercent7d || 0,
          uptime30d: health?.uptimePercent30d || 0,
          slaTarget: health?.slaTargetPercent || 99.9,
          slaCompliance: health?.slaCompliance || false,
          healthScore: health?.healthScore || 0,
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalDevices: slaData.length,
      compliant: slaData.filter(d => d.slaCompliance).length,
      nonCompliant: slaData.filter(d => !d.slaCompliance).length,
      avgUptime24h: this.calculateAverage(slaData.map(d => d.uptime24h)),
      avgUptime7d: this.calculateAverage(slaData.map(d => d.uptime7d)),
      avgUptime30d: this.calculateAverage(slaData.map(d => d.uptime30d)),
      avgHealthScore: this.calculateAverage(slaData.map(d => d.healthScore)),
    };

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    return {
      reportType: 'sla',
      generatedAt: new Date(),
      parameters: params,
      summary,
      data: slaData,
      rowCount: slaData.length,
      durationSeconds,
    };
  }

  /**
   * Generate Uptime Report
   */
  async generateUptimeReport(params: ReportParams): Promise<any> {
    const devices = await this.getFilteredDevices(params);

    const uptimeData = await Promise.all(
      devices.map(async (device) => {
        const health = await this.healthRepo.findOne({
          where: { assetId: device.id },
        });

        return {
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          location: device.location,
          status: device.status,
          lastSeen: health?.lastSeen,
          uptime24h: health?.uptimePercent24h || 0,
          uptime7d: health?.uptimePercent7d || 0,
          uptime30d: health?.uptimePercent30d || 0,
          downtime24h: 100 - (health?.uptimePercent24h || 0),
          downtime7d: 100 - (health?.uptimePercent7d || 0),
          downtime30d: 100 - (health?.uptimePercent30d || 0),
        };
      })
    );

    return {
      reportType: 'uptime',
      generatedAt: new Date(),
      parameters: params,
      data: uptimeData,
      rowCount: uptimeData.length,
    };
  }

  /**
   * Generate Performance Report
   */
  async generatePerformanceReport(params: ReportParams): Promise<any> {
    const devices = await this.getFilteredDevices(params);

    const performanceData = await Promise.all(
      devices.map(async (device) => {
        // Get metrics for the date range
        const metrics = await this.metricsRepo.find({
          where: {
            assetId: device.id,
            timestamp: Between(params.startDate, params.endDate),
          },
        });

        // Group by metric type
        const metricsByType = this.groupMetricsByType(metrics);

        return {
          deviceId: device.id,
          deviceName: device.name,
          deviceType: device.type,
          location: device.location,
          metrics: {
            cpu: this.calculateMetricStats(metricsByType['cpu'] || []),
            memory: this.calculateMetricStats(metricsByType['memory'] || []),
            disk: this.calculateMetricStats(metricsByType['disk'] || []),
            bandwidthIn: this.calculateMetricStats(metricsByType['bandwidth_in'] || []),
            bandwidthOut: this.calculateMetricStats(metricsByType['bandwidth_out'] || []),
          },
          dataPoints: metrics.length,
        };
      })
    );

    return {
      reportType: 'performance',
      generatedAt: new Date(),
      parameters: params,
      data: performanceData,
      rowCount: performanceData.length,
    };
  }

  /**
   * Generate Custom Report
   */
  async generateCustomReport(reportDefId: number, params: ReportParams): Promise<any> {
    const reportDef = await this.reportDefRepo.findOne({
      where: { id: reportDefId },
    });

    if (!reportDef) {
      throw new NotFoundException('Report definition not found');
    }

    // Merge definition parameters with runtime parameters
    const mergedParams = {
      ...reportDef.parameters,
      ...params,
    };

    // Generate based on report type
    let reportData;
    switch (reportDef.reportType) {
      case 'sla':
        reportData = await this.generateSLAReport(mergedParams);
        break;
      case 'uptime':
        reportData = await this.generateUptimeReport(mergedParams);
        break;
      case 'performance':
        reportData = await this.generatePerformanceReport(mergedParams);
        break;
      default:
        throw new Error('Unsupported report type');
    }

    return {
      ...reportData,
      reportDefinition: {
        id: reportDef.id,
        name: reportDef.reportName,
        description: reportDef.description,
      },
    };
  }

  /**
   * Save report to history
   */
  async saveToHistory(
    reportDefId: number,
    reportData: any,
    userId: number,
    scheduleId?: number
  ): Promise<ReportHistory> {
    const history = this.reportHistoryRepo.create({
      reportDefinitionId: reportDefId,
      scheduleId: scheduleId || null,
      reportName: reportData.reportDefinition?.name || 'Generated Report',
      reportType: reportData.reportType,
      format: 'json',
      status: 'completed',
      startTime: new Date(Date.now() - (reportData.durationSeconds || 0) * 1000),
      endTime: new Date(),
      durationSeconds: reportData.durationSeconds || 0,
      rowCount: reportData.rowCount || 0,
      parameters: reportData.parameters,
      generatedBy: userId,
      isScheduled: !!scheduleId,
    });

    return this.reportHistoryRepo.save(history);
  }

  /**
   * Get report history
   */
  async getReportHistory(filters?: {
    reportDefId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ReportHistory[]> {
    const query = this.reportHistoryRepo.createQueryBuilder('rh');

    if (filters?.reportDefId) {
      query.andWhere('rh.report_definition_id = :id', { id: filters.reportDefId });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('rh.created_at BETWEEN :start AND :end', {
        start: filters.startDate,
        end: filters.endDate,
      });
    }

    query.orderBy('rh.created_at', 'DESC');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query.getMany();
  }

  /**
   * Helper: Get filtered devices
   */
  private async getFilteredDevices(params: ReportParams): Promise<Asset[]> {
    let query = this.assetRepo.createQueryBuilder('a')
      .where('a.monitoringEnabled = :enabled', { enabled: true });

    if (params.assetIds && params.assetIds.length > 0) {
      query = query.andWhereInIds(params.assetIds);
    }

    if (params.tier) {
      query = query.andWhere('a.tier = :tier', { tier: params.tier });
    }

    if (params.location) {
      query = query.andWhere('a.location = :location', { location: params.location });
    }

    if (params.deviceType) {
      query = query.andWhere('a.type = :type', { type: params.deviceType });
    }

    return query.getMany();
  }

  /**
   * Helper: Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return parseFloat((sum / values.length).toFixed(2));
  }

  /**
   * Helper: Group metrics by type
   */
  private groupMetricsByType(metrics: DeviceMetricsHistory[]): Record<string, DeviceMetricsHistory[]> {
    return metrics.reduce((acc, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = [];
      }
      acc[metric.metricType].push(metric);
      return acc;
    }, {} as Record<string, DeviceMetricsHistory[]>);
  }

  /**
   * Helper: Calculate metric statistics
   */
  private calculateMetricStats(metrics: DeviceMetricsHistory[]): any {
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    return {
      avg: this.calculateAverage(values),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }
}
