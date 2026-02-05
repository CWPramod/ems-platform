// Top Talkers Service
// Analyzes network traffic and identifies top bandwidth consumers
// apps/api/src/monitoring/top-talkers/top-talkers.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { TrafficFlow } from '../../entities/traffic-flow.entity';
import { DeviceInterface } from '../../entities/device-interface.entity';

@Injectable()
export class TopTalkersService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(TrafficFlow)
    private trafficRepo: Repository<TrafficFlow>,
    @InjectRepository(DeviceInterface)
    private interfaceRepo: Repository<DeviceInterface>,
  ) {}

  /**
   * Get top talkers by bandwidth
   */
  async getTopTalkers(
    limit: number = 10,
    timeRange: '1h' | '24h' | '7d' = '1h',
    metric: 'bytes' | 'packets' = 'bytes'
  ): Promise<any> {
    const startTime = this.getStartTime(timeRange);

    const query = this.trafficRepo
      .createQueryBuilder('tf')
      .select('tf.assetId', 'assetId')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('SUM(tf.packetsIn + tf.packetsOut)', 'totalPackets')
      .addSelect('COUNT(*)', 'flowCount')
      .where('tf.timestamp >= :startTime', { startTime })
      .groupBy('tf.assetId')
      .orderBy(
        metric === 'bytes' ? 'SUM(tf.bytesIn + tf.bytesOut)' : 'SUM(tf.packetsIn + tf.packetsOut)',
        'DESC'
      )
      .limit(limit);

    const results = await query.getRawMany();

    // Get device details
    const topTalkers = await Promise.all(
      results.map(async (result) => {
        const device = await this.assetRepo.findOne({
          where: { id: result.assetId },
        });

        return {
          device: {
            id: device?.id,
            name: device?.name,
            type: device?.type,
            ip: device?.ip,
            location: device?.location,
          },
          traffic: {
            totalBytes: parseInt(result.totalBytes),
            totalBytesGB: (parseInt(result.totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
            totalPackets: parseInt(result.totalPackets),
            flowCount: parseInt(result.flowCount),
          },
        };
      })
    );

    return {
      timeRange,
      metric,
      topTalkers,
      count: topTalkers.length,
    };
  }

  /**
   * Get top conversations (source-destination pairs)
   */
  async getTopConversations(
    limit: number = 10,
    timeRange: '1h' | '24h' | '7d' = '1h'
  ): Promise<any> {
    const startTime = this.getStartTime(timeRange);

    const query = this.trafficRepo
      .createQueryBuilder('tf')
      .select('tf.sourceIp', 'sourceIp')
      .addSelect('tf.destinationIp', 'destinationIp')
      .addSelect('tf.protocol', 'protocol')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('SUM(tf.packetsIn + tf.packetsOut)', 'totalPackets')
      .addSelect('COUNT(*)', 'flowCount')
      .where('tf.timestamp >= :startTime', { startTime })
      .groupBy('tf.sourceIp, tf.destinationIp, tf.protocol')
      .orderBy('SUM(tf.bytesIn + tf.bytesOut)', 'DESC')
      .limit(limit);

    const results = await query.getRawMany();

    return {
      timeRange,
      conversations: results.map(r => ({
        source: r.sourceIp,
        destination: r.destinationIp,
        protocol: r.protocol,
        totalBytes: parseInt(r.totalBytes),
        totalBytesGB: (parseInt(r.totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
        totalPackets: parseInt(r.totalPackets),
        flowCount: parseInt(r.flowCount),
      })),
      count: results.length,
    };
  }

  /**
   * Get top protocols
   */
  async getTopProtocols(
    limit: number = 10,
    timeRange: '1h' | '24h' | '7d' = '1h'
  ): Promise<any> {
    const startTime = this.getStartTime(timeRange);

    const query = this.trafficRepo
      .createQueryBuilder('tf')
      .select('tf.protocol', 'protocol')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('SUM(tf.packetsIn + tf.packetsOut)', 'totalPackets')
      .addSelect('COUNT(*)', 'flowCount')
      .addSelect('COUNT(DISTINCT tf.assetId)', 'deviceCount')
      .where('tf.timestamp >= :startTime', { startTime })
      .groupBy('tf.protocol')
      .orderBy('SUM(tf.bytesIn + tf.bytesOut)', 'DESC')
      .limit(limit);

    const results = await query.getRawMany();

    const total = results.reduce((sum, r) => sum + parseInt(r.totalBytes), 0);

    return {
      timeRange,
      protocols: results.map(r => ({
        protocol: r.protocol,
        totalBytes: parseInt(r.totalBytes),
        totalBytesGB: (parseInt(r.totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
        totalPackets: parseInt(r.totalPackets),
        flowCount: parseInt(r.flowCount),
        deviceCount: parseInt(r.deviceCount),
        percentage: total > 0 ? ((parseInt(r.totalBytes) / total) * 100).toFixed(2) : 0,
      })),
      count: results.length,
    };
  }

  /**
   * Get traffic by interface
   */
  async getTopInterfaces(
    limit: number = 10,
    timeRange: '1h' | '24h' | '7d' = '1h'
  ): Promise<any> {
    const startTime = this.getStartTime(timeRange);

    const query = this.trafficRepo
      .createQueryBuilder('tf')
      .select('tf.interfaceId', 'interfaceId')
      .addSelect('tf.assetId', 'assetId')
      .addSelect('SUM(tf.bytesIn)', 'bytesIn')
      .addSelect('SUM(tf.bytesOut)', 'bytesOut')
      .addSelect('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .where('tf.timestamp >= :startTime', { startTime })
      .andWhere('tf.interfaceId IS NOT NULL')
      .groupBy('tf.interfaceId, tf.assetId')
      .orderBy('SUM(tf.bytesIn + tf.bytesOut)', 'DESC')
      .limit(limit);

    const results = await query.getRawMany();

    // Get interface and device details
    const topInterfaces = await Promise.all(
      results.map(async (result) => {
        const interface_ = await this.interfaceRepo.findOne({
          where: { id: result.interfaceId },
        });

        const device = await this.assetRepo.findOne({
          where: { id: result.assetId },
        });

        return {
          interface: {
            id: interface_?.id,
            name: interface_?.interfaceName,
            ip: interface_?.ipAddress,
          },
          device: {
            id: device?.id,
            name: device?.name,
            type: device?.type,
          },
          traffic: {
            bytesIn: parseInt(result.bytesIn),
            bytesOut: parseInt(result.bytesOut),
            totalBytes: parseInt(result.totalBytes),
            totalGB: (parseInt(result.totalBytes) / (1024 * 1024 * 1024)).toFixed(2),
          },
        };
      })
    );

    return {
      timeRange,
      topInterfaces,
      count: topInterfaces.length,
    };
  }

  /**
   * Get device traffic details
   */
  async getDeviceTraffic(
    assetId: string,
    timeRange: '1h' | '24h' | '7d' = '24h'
  ): Promise<any> {
    const device = await this.assetRepo.findOne({ where: { id: assetId } });
    
    if (!device) {
      return null;
    }

    const startTime = this.getStartTime(timeRange);

    const flows = await this.trafficRepo.find({
      where: {
        assetId,
        timestamp: MoreThanOrEqual(startTime),
      },
      order: {
        timestamp: 'DESC',
      },
      take: 100,
    });

    const totalBytesIn = flows.reduce((sum, f) => sum + Number(f.bytesIn), 0);
    const totalBytesOut = flows.reduce((sum, f) => sum + Number(f.bytesOut), 0);
    const totalPacketsIn = flows.reduce((sum, f) => sum + Number(f.packetsIn), 0);
    const totalPacketsOut = flows.reduce((sum, f) => sum + Number(f.packetsOut), 0);

    // Group by protocol
    const byProtocol = flows.reduce((acc, flow) => {
      if (!acc[flow.protocol]) {
        acc[flow.protocol] = { bytes: 0, packets: 0, flows: 0 };
      }
      acc[flow.protocol].bytes += Number(flow.bytesIn) + Number(flow.bytesOut);
      acc[flow.protocol].packets += Number(flow.packetsIn) + Number(flow.packetsOut);
      acc[flow.protocol].flows += 1;
      return acc;
    }, {});

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
      },
      timeRange,
      summary: {
        totalBytesIn,
        totalBytesOut,
        totalBytes: totalBytesIn + totalBytesOut,
        totalGB: ((totalBytesIn + totalBytesOut) / (1024 * 1024 * 1024)).toFixed(2),
        totalPacketsIn,
        totalPacketsOut,
        totalFlows: flows.length,
      },
      byProtocol,
      recentFlows: flows.slice(0, 20),
    };
  }

  /**
   * Get traffic statistics
   */
  async getTrafficStats(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    const startTime = this.getStartTime(timeRange);

    const stats = await this.trafficRepo
      .createQueryBuilder('tf')
      .select('SUM(tf.bytesIn + tf.bytesOut)', 'totalBytes')
      .addSelect('SUM(tf.packetsIn + tf.packetsOut)', 'totalPackets')
      .addSelect('COUNT(*)', 'totalFlows')
      .addSelect('COUNT(DISTINCT tf.assetId)', 'activeDevices')
      .addSelect('COUNT(DISTINCT tf.protocol)', 'protocolCount')
      .where('tf.timestamp >= :startTime', { startTime })
      .getRawOne();

    return {
      timeRange,
      totalBytes: parseInt(stats.totalBytes || '0'),
      totalGB: (parseInt(stats.totalBytes || '0') / (1024 * 1024 * 1024)).toFixed(2),
      totalPackets: parseInt(stats.totalPackets || '0'),
      totalFlows: parseInt(stats.totalFlows || '0'),
      activeDevices: parseInt(stats.activeDevices || '0'),
      protocolCount: parseInt(stats.protocolCount || '0'),
    };
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
      default:
        return new Date(now.getTime() - 3600000);
    }
  }
}
