// Discovery Controller
// REST API endpoints for network device discovery
// apps/api/src/masters/discovery/discovery.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@ApiTags('masters')
@Controller('api/v1/masters/discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Start a network scan
   * POST /api/v1/masters/discovery/scan
   */
  @Post('scan')
  @Permissions('devices:create')
  @UseGuards(RbacGuard)
  async startScan(
    @Body() body: {
      startIp: string;
      endIp: string;
      subnet?: string;
      snmpCommunity?: string;
      timeout?: number;
    },
  ) {
    const result = await this.discoveryService.startScan(body);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get scan status
   * GET /api/v1/masters/discovery/scan/:id/status
   */
  @Get('scan/:id/status')
  @Permissions('devices:read')
  @UseGuards(RbacGuard)
  async getScanStatus(@Param('id') id: string) {
    const status = this.discoveryService.getScanStatus(id);
    if (!status) {
      return { success: false, message: 'Scan not found' };
    }

    return {
      success: true,
      data: {
        id: status.id,
        status: status.status,
        progress: status.progress,
        totalIPs: status.totalIPs,
        scannedIPs: status.scannedIPs,
        devicesFound: status.discoveredDevices.length,
        startedAt: status.startedAt,
        completedAt: status.completedAt,
        errors: status.errors,
      },
    };
  }

  /**
   * Get scan results (discovered devices)
   * GET /api/v1/masters/discovery/scan/:id/results
   */
  @Get('scan/:id/results')
  @Permissions('devices:read')
  @UseGuards(RbacGuard)
  async getScanResults(@Param('id') id: string) {
    const results = this.discoveryService.getScanResults(id);
    if (!results) {
      return { success: false, message: 'Scan not found' };
    }

    return {
      success: true,
      data: results,
      count: results.length,
    };
  }

  /**
   * Import discovered devices as assets
   * POST /api/v1/masters/discovery/scan/:id/import
   */
  @Post('scan/:id/import')
  @Permissions('devices:create')
  @UseGuards(RbacGuard)
  async importDevices(
    @Param('id') id: string,
    @Body() body: {
      deviceIPs: string[];
      tier?: number;
      location?: string;
      customerId?: number;
    },
  ) {
    const result = await this.discoveryService.importDevices(
      id,
      body.deviceIPs,
      {
        tier: body.tier,
        location: body.location,
        customerId: body.customerId,
      },
    );

    return {
      success: true,
      data: result,
    };
  }
}
