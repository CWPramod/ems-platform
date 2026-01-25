// Topology Controller
// REST API endpoints for network topology visualization
// apps/api/src/monitoring/topology/topology.controller.ts

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TopologyService } from './topology.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@Controller('api/v1/monitoring/topology')
@UseGuards(JwtAuthGuard)
export class TopologyController {
  constructor(private readonly topologyService: TopologyService) {}

  /**
   * Get complete network topology
   * GET /api/v1/monitoring/topology/network
   */
  @Get('network')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getNetworkTopology(
    @Query('tier') tier?: string,
    @Query('location') location?: string,
    @Query('deviceType') deviceType?: string,
  ) {
    const filters: any = {};
    if (tier) filters.tier = parseInt(tier);
    if (location) filters.location = location;
    if (deviceType) filters.deviceType = deviceType;

    const topology = await this.topologyService.getNetworkTopology(filters);
    return {
      success: true,
      data: topology,
    };
  }

  /**
   * Get device neighbors
   * GET /api/v1/monitoring/topology/device/:id/neighbors
   */
  @Get('device/:id/neighbors')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDeviceNeighbors(@Param('id') id: string) {
    const neighbors = await this.topologyService.getDeviceNeighbors(id);
    return {
      success: true,
      data: neighbors,
    };
  }

  /**
   * Get connection details
   * GET /api/v1/monitoring/topology/connection/:id
   */
  @Get('connection/:id')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getConnectionDetails(@Param('id', ParseIntPipe) id: number) {
    const connection = await this.topologyService.getConnectionDetails(id);
    return {
      success: true,
      data: connection,
    };
  }

  /**
   * Get topology by location
   * GET /api/v1/monitoring/topology/location/:location
   */
  @Get('location/:location')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopologyByLocation(@Param('location') location: string) {
    const topology = await this.topologyService.getTopologyByLocation(location);
    return {
      success: true,
      data: topology,
    };
  }

  /**
   * Get critical path between two devices
   * GET /api/v1/monitoring/topology/path?source=id1&destination=id2
   */
  @Get('path')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getCriticalPath(
    @Query('source') source: string,
    @Query('destination') destination: string,
  ) {
    const path = await this.topologyService.getCriticalPath(source, destination);
    return {
      success: true,
      data: path,
    };
  }

  /**
   * Get topology statistics
   * GET /api/v1/monitoring/topology/stats
   */
  @Get('stats')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopologyStats() {
    const stats = await this.topologyService.getTopologyStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Health check
   * GET /api/v1/monitoring/topology/health
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'topology',
      status: 'operational',
    };
  }
}
