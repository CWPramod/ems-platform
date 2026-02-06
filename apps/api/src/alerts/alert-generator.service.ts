// Alert Generation Service
// Monitors device health metrics and automatically generates alerts
// File: src/alerts/alert-generator.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { Event, EventSource, EventSeverity } from '../entities/event.entity';

// Alert thresholds
const THRESHOLDS = {
  CPU_CRITICAL: 45,
  CPU_WARNING: 40,
  MEMORY_CRITICAL: 60,
  MEMORY_WARNING: 50,
  PACKET_LOSS_CRITICAL: 0.3,
  PACKET_LOSS_WARNING: 0.1,
  LATENCY_CRITICAL: 25,
  LATENCY_WARNING: 15,
  DEVICE_DOWN: 'offline',
};

@Injectable()
export class AlertGeneratorService {
  private readonly logger = new Logger(AlertGeneratorService.name);
  private readonly dataMode: string;
  private lastAlerts: Map<string, Date> = new Map(); // Prevent duplicate alerts

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(DeviceHealth)
    private healthRepository: Repository<DeviceHealth>,
  ) {
    this.dataMode = process.env.DATA_MODE || 'demo';
    this.logger.log(`Alert Generator initialized in ${this.dataMode.toUpperCase()} mode`);
  }

  /**
   * Check for alerts every minute
   * Note: Runs in both demo and production modes.
   * In demo mode, alerts are based on simulated health data.
   * In production mode, alerts are based on real SNMP-collected health data.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkForAlerts() {
    this.logger.log(`Checking for alert conditions (${this.dataMode} mode)...`);

    try {
      // Get all devices
      const devices = await this.assetRepository.find({
        where: [
          { type: 'router' as any },
          { type: 'switch' as any },
          { type: 'firewall' as any },
        ],
      });

      let alertsGenerated = 0;

      for (const device of devices) {
        const health = await this.healthRepository.findOne({
          where: { assetId: device.id },
        });

        if (!health) continue;

        this.logger.log(`\n=== ${device.name} (${device.ip}) ===`);
        this.logger.log(`CPU: ${health.cpuUtilization} (Threshold: ${THRESHOLDS.CPU_WARNING})`);
        this.logger.log(`Memory: ${health.memoryUtilization} (Threshold: ${THRESHOLDS.MEMORY_WARNING})`);
        this.logger.log(`Status: ${device.status}`);

        // Check device status
        if (device.status === THRESHOLDS.DEVICE_DOWN) {
          await this.generateAlert(
            device,
            'Device Down',
            `Device ${device.name} (${device.ip}) is offline`,
            'critical',
            'connectivity'
          );
          alertsGenerated++;
        }

        // Check CPU
        const cpu = parseFloat(String(health.cpuUtilization || '0'));
        if (cpu >= THRESHOLDS.CPU_CRITICAL) {
          await this.generateAlert(
            device,
            'Critical CPU Usage',
            `CPU usage on ${device.name} (${device.ip}) is ${cpu.toFixed(1)}% (Critical threshold: ${THRESHOLDS.CPU_CRITICAL}%)`,
            'critical',
            'performance'
          );
          alertsGenerated++;
        } else if (cpu >= THRESHOLDS.CPU_WARNING) {
          await this.generateAlert(
            device,
            'High CPU Usage',
            `CPU usage on ${device.name} (${device.ip}) is ${cpu.toFixed(1)}% (Warning threshold: ${THRESHOLDS.CPU_WARNING}%)`,
            'warning',
            'performance'
          );
          alertsGenerated++;
        }

        // Check Memory
        const memory = parseFloat(String(health.memoryUtilization || '0'));
        if (memory >= THRESHOLDS.MEMORY_CRITICAL) {
          await this.generateAlert(
            device,
            'Critical Memory Usage',
            `Memory usage on ${device.name} (${device.ip}) is ${memory.toFixed(1)}% (Critical threshold: ${THRESHOLDS.MEMORY_CRITICAL}%)`,
            'critical',
            'performance'
          );
          alertsGenerated++;
        } else if (memory >= THRESHOLDS.MEMORY_WARNING) {
          await this.generateAlert(
            device,
            'High Memory Usage',
            `Memory usage on ${device.name} (${device.ip}) is ${memory.toFixed(1)}% (Warning threshold: ${THRESHOLDS.MEMORY_WARNING}%)`,
            'warning',
            'performance'
          );
          alertsGenerated++;
        }

        // Check Packet Loss
        const packetLoss = parseFloat(String(health.packetLossPercent || '0'));
        if (packetLoss >= THRESHOLDS.PACKET_LOSS_CRITICAL) {
          await this.generateAlert(
            device,
            'Critical Packet Loss',
            `Packet loss on ${device.name} (${device.ip}) is ${packetLoss.toFixed(2)}% (Critical threshold: ${THRESHOLDS.PACKET_LOSS_CRITICAL}%)`,
            'critical',
            'connectivity'
          );
          alertsGenerated++;
        } else if (packetLoss >= THRESHOLDS.PACKET_LOSS_WARNING) {
          await this.generateAlert(
            device,
            'High Packet Loss',
            `Packet loss on ${device.name} (${device.ip}) is ${packetLoss.toFixed(2)}% (Warning threshold: ${THRESHOLDS.PACKET_LOSS_WARNING}%)`,
            'warning',
            'connectivity'
          );
          alertsGenerated++;
        }

        // Check Latency
        const latency = parseFloat(String(health.latencyMs || '0'));
        if (latency >= THRESHOLDS.LATENCY_CRITICAL) {
          await this.generateAlert(
            device,
            'Critical Latency',
            `Latency on ${device.name} (${device.ip}) is ${latency.toFixed(1)}ms (Critical threshold: ${THRESHOLDS.LATENCY_CRITICAL}ms)`,
            'critical',
            'connectivity'
          );
          alertsGenerated++;
        } else if (latency >= THRESHOLDS.LATENCY_WARNING) {
          await this.generateAlert(
            device,
            'High Latency',
            `Latency on ${device.name} (${device.ip}) is ${latency.toFixed(1)}ms (Warning threshold: ${THRESHOLDS.LATENCY_WARNING}ms)`,
            'warning',
            'connectivity'
          );
          alertsGenerated++;
        }
      }

      if (alertsGenerated > 0) {
        this.logger.log(`Generated ${alertsGenerated} alerts`);
      } else {
        this.logger.debug('No alert conditions detected');
      }

      // Clean up old resolved/closed alerts (older than 7 days)
      await this.cleanupOldAlerts();
    } catch (error) {
      this.logger.error(`Error checking for alerts: ${error.message}`);
    }
  }

  /**
   * Generate an alert (with deduplication)
   */
  private async generateAlert(
    device: Asset,
    title: string,
    description: string,
    severity: 'critical' | 'warning' | 'info',
    category: string
  ): Promise<void> {
    // Deduplication: Don't create duplicate alerts within 5 minutes
    const alertKey = `${device.id}-${title}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    const now = new Date();

    if (lastAlert && (now.getTime() - lastAlert.getTime()) < 5 * 60 * 1000) {
      this.logger.debug(`Skipping duplicate alert: ${title} for ${device.name}`);
      return;
    }

    try {
      // Create event first
      const event = this.eventRepository.create({
        fingerprint: `${device.id.substring(0, 8)}-${category}-${severity}`,
        source: EventSource.NMS,
        assetId: device.id,
        severity: severity as any,
        category: category,
        title: title,
        message: description,
        timestamp: new Date(),
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        metadata: {
          deviceName: device.name,
          deviceIp: device.ip,
          location: device.location,
          tier: device.tier,
        },
      });

      const savedEvent = await this.eventRepository.save(event);

      // Create alert
      const alert = this.alertRepository.create({
        eventId: savedEvent.id,
        status: AlertStatus.OPEN,
        rootCauseAssetId: device.id,
        slaDeadline: new Date(Date.now() + (severity === 'critical' ? 4 : 24) * 60 * 60 * 1000),
        slaBreached: false,
      });

      await this.alertRepository.save(alert);

      // Update last alert time
      this.lastAlerts.set(alertKey, now);

      this.logger.log(`Created ${severity.toUpperCase()} alert: ${title} for ${device.name} (${device.ip})`);
    } catch (error) {
      this.logger.error(`Failed to create alert: ${error.message}`);
    }
  }

  /**
   * Clean up old resolved/closed alerts
   */
  private async cleanupOldAlerts(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const result = await this.alertRepository
        .createQueryBuilder()
        .delete()
        .where('status IN (:...statuses)', { statuses: ['resolved', 'closed'] })
        .andWhere('updatedAt < :date', { date: sevenDaysAgo })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} old alerts`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup old alerts: ${error.message}`);
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<any> {
    const [total, critical, warning, open, acknowledged] = await Promise.all([
      this.alertRepository.count(),
      this.alertRepository.count({
        where: { event: { severity: 'critical' as any } },
        relations: ['event'],
      }),
      this.alertRepository.count({
        where: { event: { severity: 'warning' as any } },
        relations: ['event'],
      }),
      this.alertRepository.count({ where: { status: AlertStatus.OPEN } }),
      this.alertRepository.count({ where: { status: AlertStatus.ACKNOWLEDGED } }),
    ]);

    return {
      total,
      critical,
      warning,
      open,
      acknowledged,
      resolved: total - open - acknowledged,
    };
  }
}
