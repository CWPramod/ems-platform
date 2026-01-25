// Topology Service
// Provides network topology data and device connections
// apps/api/src/monitoring/topology/topology.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';
import { DeviceConnection } from '../../entities/device-connection.entity';
import { DeviceInterface } from '../../entities/device-interface.entity';

@Injectable()
export class TopologyService {
  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(DeviceConnection)
    private connectionRepo: Repository<DeviceConnection>,
    @InjectRepository(DeviceInterface)
    private interfaceRepo: Repository<DeviceInterface>,
  ) {}

  /**
   * Get complete network topology
   */
  async getNetworkTopology(filters?: {
    tier?: number;
    location?: string;
    deviceType?: string;
  }): Promise<any> {
    // Get devices
    let deviceQuery = this.assetRepo.createQueryBuilder('a')
      .where('a.monitoringEnabled = :enabled', { enabled: true });

    if (filters?.tier) {
      deviceQuery = deviceQuery.andWhere('a.tier = :tier', { tier: filters.tier });
    }

    if (filters?.location) {
      deviceQuery = deviceQuery.andWhere('a.location = :location', { location: filters.location });
    }

    if (filters?.deviceType) {
      deviceQuery = deviceQuery.andWhere('a.type = :type', { type: filters.deviceType });
    }

    const devices = await deviceQuery.getMany();
    const deviceIds = devices.map(d => d.id);

    // Get connections between these devices
    const connections = await this.connectionRepo
      .createQueryBuilder('c')
      .where('c.source_asset_id IN (:...ids)', { ids: deviceIds })
      .andWhere('c.destination_asset_id IN (:...ids)', { ids: deviceIds })
      .andWhere('c.is_active = :active', { active: true })
      .getMany();

    // Format for visualization
    const nodes = devices.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      tier: d.tier,
      location: d.location,
      ip: d.ip,
      status: d.status,
      vendor: d.vendor,
    }));

    const links = connections.map(c => ({
      id: c.id,
      source: c.sourceAssetId,
      target: c.destinationAssetId,
      type: c.connectionType,
      status: c.linkStatus,
      bandwidth: c.linkSpeedMbps,
      utilization: c.bandwidthUtilization,
      latency: c.latency,
      protocol: c.protocol,
    }));

    return {
      nodes,
      links,
      summary: {
        totalDevices: nodes.length,
        totalConnections: links.length,
        byType: this.groupByType(devices),
        byTier: this.groupByTier(devices),
        byLocation: this.groupByLocation(devices),
      },
    };
  }

  /**
   * Get device neighbors
   */
  async getDeviceNeighbors(assetId: string): Promise<any> {
    const device = await this.assetRepo.findOne({ where: { id: assetId } });
    
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Get outgoing connections
    const outgoing = await this.connectionRepo.find({
      where: { sourceAssetId: assetId, isActive: true },
    });

    // Get incoming connections
    const incoming = await this.connectionRepo.find({
      where: { destinationAssetId: assetId, isActive: true },
    });

    // Get neighbor device details
    const neighborIds = [
      ...outgoing.map(c => c.destinationAssetId),
      ...incoming.map(c => c.sourceAssetId),
    ];

    const neighbors = await this.assetRepo
      .createQueryBuilder('a')
      .whereInIds(neighborIds)
      .getMany();

    return {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
      },
      neighbors: neighbors.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        ip: n.ip,
        location: n.location,
        tier: n.tier,
      })),
      connections: {
        outgoing: outgoing.length,
        incoming: incoming.length,
        total: outgoing.length + incoming.length,
      },
      links: [...outgoing, ...incoming],
    };
  }

  /**
   * Get connection details
   */
  async getConnectionDetails(connectionId: number): Promise<any> {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    const sourceDevice = await this.assetRepo.findOne({
      where: { id: connection.sourceAssetId },
    });

    const destDevice = await this.assetRepo.findOne({
      where: { id: connection.destinationAssetId },
    });

    let sourceInterface: DeviceInterface | null = null;
    let destInterface: DeviceInterface | null = null;

    if (connection.sourceInterfaceId) {
      sourceInterface = await this.interfaceRepo.findOne({
        where: { id: connection.sourceInterfaceId },
      });
    }

    if (connection.destinationInterfaceId) {
      destInterface = await this.interfaceRepo.findOne({
        where: { id: connection.destinationInterfaceId },
      });
    }

    return {
      connection,
      source: {
        device: sourceDevice,
        interface: sourceInterface,
      },
      destination: {
        device: destDevice,
        interface: destInterface,
      },
      metrics: {
        bandwidth: connection.linkSpeedMbps,
        utilization: connection.bandwidthUtilization,
        latency: connection.latency,
        packetLoss: connection.packetLoss,
        status: connection.linkStatus,
      },
    };
  }

  /**
   * Get topology by location
   */
  async getTopologyByLocation(location: string): Promise<any> {
    return this.getNetworkTopology({ location });
  }

  /**
   * Get critical path (devices in path between two devices)
   */
  async getCriticalPath(sourceId: string, destinationId: string): Promise<any> {
    // Simple implementation - can be enhanced with path-finding algorithms
    const sourceDevice = await this.assetRepo.findOne({ where: { id: sourceId } });
    const destDevice = await this.assetRepo.findOne({ where: { id: destinationId } });

    if (!sourceDevice || !destDevice) {
      throw new NotFoundException('Device not found');
    }

    // Get direct connection
    const directConnection = await this.connectionRepo.findOne({
      where: {
        sourceAssetId: sourceId,
        destinationAssetId: destinationId,
        isActive: true,
      },
    });

    return {
      source: sourceDevice,
      destination: destDevice,
      directConnection: directConnection ? true : false,
      connection: directConnection,
      // Can be enhanced with hop-by-hop path finding
    };
  }

  /**
   * Get topology statistics
   */
  async getTopologyStats(): Promise<any> {
    const totalDevices = await this.assetRepo.count({
      where: { monitoringEnabled: true },
    });

    const totalConnections = await this.connectionRepo.count({
      where: { isActive: true },
    });

    const activeConnections = await this.connectionRepo.count({
      where: { isActive: true, linkStatus: 'up' },
    });

    const downConnections = await this.connectionRepo.count({
      where: { isActive: true, linkStatus: 'down' },
    });

    const avgConnectionsPerDevice = totalDevices > 0 
      ? ((totalConnections / totalDevices)).toFixed(2)
      : '0';

    return {
      devices: totalDevices,
      connections: totalConnections,
      activeConnections,
      downConnections,
      avgConnectionsPerDevice: parseFloat(avgConnectionsPerDevice),
      healthScore: totalConnections > 0 
        ? ((activeConnections / totalConnections) * 100).toFixed(2) 
        : 100,
    };
  }

  /**
   * Helper: Group devices by type
   */
  private groupByType(devices: Asset[]): any {
    return devices.reduce((acc, device) => {
      const type = device.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Helper: Group devices by tier
   */
  private groupByTier(devices: Asset[]): any {
    return devices.reduce((acc, device) => {
      const tier = `tier${device.tier}`;
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Helper: Group devices by location
   */
  private groupByLocation(devices: Asset[]): any {
    return devices.reduce((acc, device) => {
      const location = device.location || 'unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});
  }
}
