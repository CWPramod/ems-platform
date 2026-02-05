// Dashboard Controller
// REST API endpoints for critical devices dashboard
// apps/api/src/monitoring/dashboard/dashboard.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@ApiTags('monitoring')
@Controller('api/v1/monitoring/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get all critical devices with health status
   * GET /api/v1/monitoring/dashboard/critical-devices
   */
  @Get('critical-devices')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getCriticalDevices() {
    const devices = await this.dashboardService.getCriticalDevices();
    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get critical devices summary
   * GET /api/v1/monitoring/dashboard/summary
   */
  @Get('summary')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getSummary() {
    const summary = await this.dashboardService.getCriticalDevicesSummary();
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Get device health details
   * GET /api/v1/monitoring/dashboard/device/:id/health
   */
  @Get('device/:id/health')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDeviceHealth(@Param('id') id: string) {
    const health = await this.dashboardService.getDeviceHealth(id);
    
    if (!health) {
      return {
        success: false,
        message: 'Device not found',
      };
    }

    return {
      success: true,
      data: health,
    };
  }

  /**
   * Get top devices by metric
   * GET /api/v1/monitoring/dashboard/top-devices?metric=cpu&limit=10
   */
  @Get('top-devices')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopDevices(
    @Query('metric') metric: 'cpu' | 'memory' | 'bandwidth' | 'alerts' = 'cpu',
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : 10;
    const devices = await this.dashboardService.getTopDevicesByMetric(metric, limitNum);
    
    return {
      success: true,
      metric,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get devices with active alerts
   * GET /api/v1/monitoring/dashboard/devices-with-alerts
   */
  @Get('devices-with-alerts')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDevicesWithAlerts() {
    const devices = await this.dashboardService.getDevicesWithAlerts();
    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get SLA compliance status
   * GET /api/v1/monitoring/dashboard/sla-compliance
   */
  @Get('sla-compliance')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getSLACompliance() {
    const compliance = await this.dashboardService.getSLACompliance();
    return {
      success: true,
      data: compliance,
    };
  }

  /**
   * Update device health (for monitoring system)
   * PUT /api/v1/monitoring/dashboard/device/:id/health
   */
  @Put('device/:id/health')
  @Permissions('dashboard:update')
  @UseGuards(RbacGuard)
  async updateDeviceHealth(
    @Param('id') id: string,
    @Body() healthData: any,
  ) {
    const health = await this.dashboardService.updateDeviceHealth(id, healthData);
    return {
      success: true,
      data: health,
      message: 'Device health updated successfully',
    };
  }

  /**
   * Dashboard health check
   * GET /api/v1/monitoring/dashboard/health
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'dashboard',
      status: 'operational',
    };
  }
}
