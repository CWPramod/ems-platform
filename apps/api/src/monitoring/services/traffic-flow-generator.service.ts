// Traffic Flow Generator Service
// Generates realistic network traffic flows for Top Talkers
// Dual-mode: Simulation (laptop) + Real SNMP aggregation (client)
// File: src/monitoring/services/traffic-flow-generator.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Asset } from '../../entities/asset.entity';
import { TrafficFlow } from '../../entities/traffic-flow.entity';
import { DeviceHealth } from '../../entities/device-health.entity';

// Protocol distribution for realistic simulation
const PROTOCOLS = [
  { name: 'HTTP', port: 80, weight: 25 },
  { name: 'HTTPS', port: 443, weight: 35 },
  { name: 'SSH', port: 22, weight: 15 },
  { name: 'DNS', port: 53, weight: 10 },
  { name: 'SMTP', port: 25, weight: 5 },
  { name: 'FTP', port: 21, weight: 3 },
  { name: 'SNMP', port: 161, weight: 2 },
  { name: 'Other', port: 0, weight: 5 },
];

@Injectable()
export class TrafficFlowGeneratorService {
  private readonly logger = new Logger(TrafficFlowGeneratorService.name);
  private readonly snmpMode: string;
  private readonly dataMode: string;
  private flowCache: Map<string, any> = new Map();

  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(TrafficFlow)
    private trafficFlowRepository: Repository<TrafficFlow>,
    @InjectRepository(DeviceHealth)
    private deviceHealthRepository: Repository<DeviceHealth>,
  ) {
    this.snmpMode = process.env.SNMP_MODE || 'simulation';
    this.dataMode = process.env.DATA_MODE || 'demo';
    this.logger.log(`Traffic Flow Generator initialized - SNMP_MODE: ${this.snmpMode.toUpperCase()}, DATA_MODE: ${this.dataMode.toUpperCase()}`);
  }

  /**
   * Generate traffic flows every 30 seconds
   * In demo mode: generates simulated traffic flows
   * In production mode: aggregates real traffic from SNMP data
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async generateTrafficFlows() {
    this.logger.log(`Generating traffic flows (DATA_MODE: ${this.dataMode})...`);

    try {
      // In production mode, only aggregate real traffic
      if (this.dataMode === 'production') {
        await this.aggregateRealTraffic();
      } else {
        // Demo mode: generate simulated flows or aggregate based on SNMP_MODE
        if (this.snmpMode === 'simulation') {
          await this.generateSimulatedFlows();
        } else {
          await this.aggregateRealTraffic();
        }
      }

      this.logger.log('Traffic flows generated successfully');
    } catch (error) {
      this.logger.error(`Failed to generate traffic flows: ${error.message}`);
    }
  }

  /**
   * Generate simulated traffic flows (for development/demo)
   */
  private async generateSimulatedFlows(): Promise<void> {
    // Get all network devices
    const devices = await this.assetRepository.find({
      where: [
        { type: 'router' as any },
        { type: 'switch' as any },
      ],
    });

    if (devices.length < 2) {
      this.logger.warn('Not enough devices to generate flows');
      return;
    }

    // Clear old flows (keep last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    await this.trafficFlowRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :date', { date: oneDayAgo })
      .execute();

    // Generate 20-30 random flows
    const flowCount = 20 + Math.floor(Math.random() * 10);
    const flows: any[] = [];

    for (let i = 0; i < flowCount; i++) {
      const sourceDevice = devices[Math.floor(Math.random() * devices.length)];
      let destDevice = devices[Math.floor(Math.random() * devices.length)];

      // Ensure source and dest are different
      while (destDevice.id === sourceDevice.id && devices.length > 1) {
        destDevice = devices[Math.floor(Math.random() * devices.length)];
      }

      const protocol = this.selectProtocolByWeight();
      const bytesTransferred = this.generateRealisticBytes(protocol.name);
      const packetsTransferred = Math.floor(bytesTransferred / (500 + Math.random() * 1000));

      flows.push({
        assetId: sourceDevice.id,
        interfaceId: null,
        sourceIp: sourceDevice.ip,
        destinationIp: destDevice.ip,
        protocol: protocol.name,
        sourcePort: 1024 + Math.floor(Math.random() * 64000),
        destinationPort: protocol.port,
        bytesIn: Math.floor(bytesTransferred * 0.6),
        bytesOut: Math.floor(bytesTransferred * 0.4),
        packetsIn: Math.floor(packetsTransferred * 0.6),
        packetsOut: Math.floor(packetsTransferred * 0.4),
        flowDuration: 10 + Math.floor(Math.random() * 50),
        timestamp: new Date(),
      });
    }

    // Save flows
    await this.trafficFlowRepository.save(flows);
    this.logger.debug(`Generated ${flows.length} simulated traffic flows`);
  }

  /**
   * Aggregate real traffic from SNMP bandwidth data (production mode)
   */
  private async aggregateRealTraffic(): Promise<void> {
    // Get bandwidth data from device_health table
    const healthRecords = await this.deviceHealthRepository.find();

    const flows: any[] = [];
    const timestamp = new Date();

    for (const health of healthRecords) {
      const device = await this.assetRepository.findOne({
        where: { id: health.assetId },
      });

      if (!device) continue;

      // Convert bandwidth to bytes (Mbps to bytes over 30 seconds)
      const bandwidthInMbps = parseFloat(String(health.bandwidthInMbps || '0'));
      const bandwidthOutMbps = parseFloat(String(health.bandwidthOutMbps || '0'));

      // Bytes = (Mbps * 1,000,000 / 8) * 30 seconds
      const bytesIn = (bandwidthInMbps * 1000000 / 8) * 30;
      const bytesOut = (bandwidthOutMbps * 1000000 / 8) * 30;

      if (bytesIn > 0 || bytesOut > 0) {
        // Create aggregated flow record (use 0.0.0.0 for external/aggregated traffic)
        flows.push({
          assetId: device.id,
          interfaceId: null,
          sourceIp: device.ip,
          destinationIp: '0.0.0.0',
          protocol: 'Aggregated',
          sourcePort: 0,
          destinationPort: 0,
          bytesIn: Math.floor(bytesIn),
          bytesOut: Math.floor(bytesOut),
          packetsIn: Math.floor(bytesIn / 1000),
          packetsOut: Math.floor(bytesOut / 1000),
          duration: 30,
          flowDuration: 30,
          timestamp,
          aggregationInterval: 30,
          metadata: {},
        });
      }
    }

    if (flows.length > 0) {
      await this.trafficFlowRepository.save(flows);
      this.logger.debug(`Aggregated ${flows.length} real traffic flows from SNMP data`);
    }
  }

  /**
   * Select protocol based on weighted distribution
   */
  private selectProtocolByWeight(): typeof PROTOCOLS[0] {
    const totalWeight = PROTOCOLS.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const protocol of PROTOCOLS) {
      random -= protocol.weight;
      if (random <= 0) {
        return protocol;
      }
    }

    return PROTOCOLS[PROTOCOLS.length - 1];
  }

  /**
   * Generate realistic bytes transferred based on protocol
   */
  private generateRealisticBytes(protocol: string): number {
    const baseRanges = {
      'HTTP': [10000, 500000],      // 10KB - 500KB
      'HTTPS': [50000, 2000000],    // 50KB - 2MB
      'SSH': [1000, 50000],         // 1KB - 50KB
      'DNS': [100, 1000],           // 100B - 1KB
      'SMTP': [5000, 1000000],      // 5KB - 1MB
      'FTP': [100000, 10000000],    // 100KB - 10MB
      'SNMP': [500, 5000],          // 500B - 5KB
      'Other': [1000, 100000],      // 1KB - 100KB
    };

    const range = baseRanges[protocol] || baseRanges['Other'];
    return Math.floor(range[0] + Math.random() * (range[1] - range[0]));
  }

  /**
   * Get top talkers by bandwidth
   */
  async getTopTalkersByBandwidth(limit: number = 10): Promise<any[]> {
    // Get flows from last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const topTalkers = await this.trafficFlowRepository
      .createQueryBuilder('tf')
      .select('tf.sourceDeviceName', 'deviceName')
      .addSelect('tf.sourceIp', 'deviceIp')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('SUM(tf.packetsTransferred)', 'totalPackets')
      .addSelect('COUNT(*)', 'flowCount')
      .where('tf.timestamp > :date', { date: oneHourAgo })
      .groupBy('tf.sourceDeviceName')
      .addGroupBy('tf.sourceIp')
      .orderBy('SUM(tf.bytesTransferred)', 'DESC')
      .limit(limit)
      .getRawMany();

    // Convert bytes to Mbps
    return topTalkers.map(talker => ({
      deviceName: talker.deviceName,
      deviceIp: talker.deviceIp,
      totalBytes: parseInt(talker.totalBytes),
      totalMbps: (parseInt(talker.totalBytes) * 8 / 1000000 / 3600).toFixed(2),
      totalPackets: parseInt(talker.totalPackets),
      flowCount: parseInt(talker.flowCount),
    }));
  }

  /**
   * Get top protocols
   */
  async getTopProtocols(limit: number = 10): Promise<any[]> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const topProtocols = await this.trafficFlowRepository
      .createQueryBuilder('tf')
      .select('tf.protocol', 'protocol')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('COUNT(*)', 'flowCount')
      .where('tf.timestamp > :date', { date: oneHourAgo })
      .groupBy('tf.protocol')
      .orderBy('SUM(tf.bytesTransferred)', 'DESC')
      .limit(limit)
      .getRawMany();

    const total = topProtocols.reduce((sum, p) => sum + parseInt(p.totalBytes), 0);

    return topProtocols.map(protocol => ({
      protocol: protocol.protocol,
      totalBytes: parseInt(protocol.totalBytes),
      totalMbps: (parseInt(protocol.totalBytes) * 8 / 1000000 / 3600).toFixed(2),
      flowCount: parseInt(protocol.flowCount),
      percentage: total > 0 ? ((parseInt(protocol.totalBytes) / total) * 100).toFixed(1) : 0,
    }));
  }

  /**
   * Get traffic trends (last 24 hours, hourly aggregation)
   */
  async getTrafficTrends(): Promise<any[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const trends = await this.trafficFlowRepository
      .createQueryBuilder('tf')
      .select("DATE_TRUNC('hour', tf.timestamp)", 'hour')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .where('tf.timestamp > :date', { date: oneDayAgo })
      .groupBy("DATE_TRUNC('hour', tf.timestamp)")
      .orderBy("DATE_TRUNC('hour', tf.timestamp)", 'ASC')
      .getRawMany();

    return trends.map(trend => ({
      timestamp: trend.hour,
      totalBytes: parseInt(trend.totalBytes),
      totalMbps: (parseInt(trend.totalBytes) * 8 / 1000000 / 3600).toFixed(2),
    }));
  }

  /**
   * Get current mode
   */
  getMode(): { snmpMode: string; dataMode: string } {
    return {
      snmpMode: this.snmpMode,
      dataMode: this.dataMode,
    };
  }
}
