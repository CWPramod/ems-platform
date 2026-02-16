import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset, AssetStatus } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';
import { TrafficFlow } from '../entities/traffic-flow.entity';
import { ProbePayloadDto, DeviceDataDto } from './dto/probe-payload.dto';

export interface ProbeStatus {
  probeId: string;
  lastSeen: Date;
  devicesManaged: number;
  lastPayloadDevices: string[];
}

@Injectable()
export class ProbeService {
  private readonly logger = new Logger(ProbeService.name);
  private probeRegistry: Map<string, ProbeStatus> = new Map();

  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(DeviceHealth)
    private deviceHealthRepository: Repository<DeviceHealth>,
    @InjectRepository(DeviceMetricsHistory)
    private metricsHistoryRepository: Repository<DeviceMetricsHistory>,
    @InjectRepository(TrafficFlow)
    private trafficFlowRepository: Repository<TrafficFlow>,
  ) {}

  async ingest(payload: ProbePayloadDto): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    this.logger.log(
      `Ingesting data from probe "${payload.probeId}" — ${payload.devices.length} device(s)`,
    );

    for (const device of payload.devices) {
      try {
        await this.processDevice(device, payload.probeId, payload.timestamp);
        processed++;
      } catch (error) {
        const msg = `Failed to process device ${device.name} (${device.assetId}): ${error.message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    // Update probe registry
    this.probeRegistry.set(payload.probeId, {
      probeId: payload.probeId,
      lastSeen: new Date(),
      devicesManaged: payload.devices.length,
      lastPayloadDevices: payload.devices.map((d) => d.name),
    });

    this.logger.log(
      `Probe "${payload.probeId}" ingestion complete: ${processed}/${payload.devices.length} devices processed`,
    );

    return { processed, errors };
  }

  private async processDevice(
    device: DeviceDataDto,
    probeId: string,
    timestamp: string,
  ): Promise<void> {
    const ts = new Date(timestamp);

    // 1. Update asset status and mark as probe-managed
    const asset = await this.assetRepository.findOne({ where: { id: device.assetId } });
    if (!asset) {
      throw new Error(`Asset ${device.assetId} not found`);
    }
    const newStatus = device.isOnline ? AssetStatus.ONLINE : AssetStatus.OFFLINE;
    const updatedMetadata = {
      ...asset.metadata,
      dataSource: 'probe',
      probeId,
      snmpReachable: device.snmpReachable,
    };
    await this.assetRepository.update(device.assetId, {
      status: newStatus,
      metadata: updatedMetadata as any,
    });

    // 2. Upsert device health
    await this.updateDeviceHealth(device, ts);

    // 3. Insert 6 rows into device_metrics_history
    await this.storeMetricsHistory(device.assetId, device.metrics, ts);

    // 4. Create traffic flow record
    await this.storeTrafficFlow(device, ts);
  }

  private async updateDeviceHealth(
    device: DeviceDataDto,
    timestamp: Date,
  ): Promise<void> {
    const { assetId, metrics, isOnline } = device;

    const health = await this.deviceHealthRepository.findOne({
      where: { assetId },
    });

    const updateData: any = {
      status: isOnline ? 'online' : 'offline',
      cpuUtilization: metrics.cpuUtilization.toFixed(2),
      memoryUtilization: metrics.memoryUtilization.toFixed(2),
      bandwidthInMbps: metrics.bandwidthIn.toFixed(2),
      bandwidthOutMbps: metrics.bandwidthOut.toFixed(2),
      packetLossPercent: metrics.packetLoss.toFixed(3),
      latencyMs: metrics.latency.toFixed(2),
      lastHealthCheck: timestamp,
    };

    if (isOnline) {
      updateData.lastSeen = timestamp;
    }

    if (health) {
      await this.deviceHealthRepository.update({ assetId }, updateData);
    } else {
      await this.deviceHealthRepository.save({
        assetId,
        ...updateData,
        healthScore: '90.00',
        totalInterfaces: 4,
        interfacesUp: isOnline ? 4 : 0,
        uptimePercent24h: '99.5',
        uptimePercent7d: '99.2',
        uptimePercent30d: '98.8',
        slaCompliance: true,
        slaTargetPercent: '99.0',
      });
    }
  }

  private async storeMetricsHistory(
    assetId: string,
    metrics: DeviceDataDto['metrics'],
    timestamp: Date,
  ): Promise<void> {
    const metricsToStore = [
      { type: 'cpu', value: metrics.cpuUtilization, unit: 'percent' },
      { type: 'memory', value: metrics.memoryUtilization, unit: 'percent' },
      { type: 'bandwidth_in', value: metrics.bandwidthIn, unit: 'mbps' },
      { type: 'bandwidth_out', value: metrics.bandwidthOut, unit: 'mbps' },
      { type: 'packet_loss', value: metrics.packetLoss, unit: 'percent' },
      { type: 'latency', value: metrics.latency, unit: 'ms' },
    ];

    await this.metricsHistoryRepository.save(
      metricsToStore.map((m) => ({
        assetId,
        metricType: m.type,
        value: parseFloat(m.value.toFixed(2)),
        unit: m.unit,
        timestamp,
        metadata: { dataSource: 'probe' },
      })),
    );
  }

  private async storeTrafficFlow(
    device: DeviceDataDto,
    timestamp: Date,
  ): Promise<void> {
    const { metrics } = device;
    // Convert Mbps to bytes for flow record (Mbps × 125000 × 30s interval)
    const bytesIn = Math.round(metrics.bandwidthIn * 125000 * 30);
    const bytesOut = Math.round(metrics.bandwidthOut * 125000 * 30);
    const packetsIn = Math.round(bytesIn / 1000);
    const packetsOut = Math.round(bytesOut / 1000);

    await this.trafficFlowRepository.save({
      assetId: device.assetId,
      sourceIp: device.ip,
      destinationIp: '0.0.0.0',
      protocol: 'SNMP',
      bytesIn,
      bytesOut,
      packetsIn,
      packetsOut,
      flowDuration: 30,
      timestamp,
      aggregationInterval: 30,
      metadata: { dataSource: 'probe' },
    });
  }

  getProbeStatus(probeId: string): ProbeStatus | null {
    return this.probeRegistry.get(probeId) || null;
  }

  getAllProbes(): ProbeStatus[] {
    return Array.from(this.probeRegistry.values());
  }
}
