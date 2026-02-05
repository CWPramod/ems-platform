// Drill-down Controller
// REST API endpoints for detailed device views and performance metrics
// apps/api/src/monitoring/drilldown/drilldown.controller.ts

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DrilldownService } from './drilldown.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@ApiTags('monitoring')
@Controller('api/v1/monitoring/drilldown')
@UseGuards(JwtAuthGuard)
export class DrilldownController {
  constructor(private readonly drilldownService: DrilldownService) {}

  /**
   * Get complete device overview
   * GET /api/v1/monitoring/drilldown/device/:id/overview
   */
  @Get('device/:id/overview')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDeviceOverview(@Param('id') id: string) {
    const overview = await this.drilldownService.getDeviceOverview(id);
    return {
      success: true,
      data: overview,
    };
  }

  /**
   * Get performance history for a metric
   * GET /api/v1/monitoring/drilldown/device/:id/history/:metricType?timeRange=24h
   */
  @Get('device/:id/history/:metricType')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getPerformanceHistory(
    @Param('id') id: string,
    @Param('metricType') metricType: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d' | '30d',
  ) {
    const history = await this.drilldownService.getPerformanceHistory(
      id,
      metricType,
      timeRange || '24h',
    );
    return {
      success: true,
      data: history,
    };
  }

  /**
   * Get metrics trend comparison
   * GET /api/v1/monitoring/drilldown/device/:id/trends?metrics=cpu,memory&timeRange=24h
   */
  @Get('device/:id/trends')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getMetricsTrend(
    @Param('id') id: string,
    @Query('metrics') metrics?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d' | '30d',
  ) {
    const metricTypes = metrics ? metrics.split(',') : ['cpu', 'memory', 'bandwidth_in'];
    const trends = await this.drilldownService.getMetricsTrend(
      id,
      metricTypes,
      timeRange || '24h',
    );
    return {
      success: true,
      data: trends,
    };
  }

  /**
   * Get all interfaces for a device
   * GET /api/v1/monitoring/drilldown/device/:id/interfaces
   */
  @Get('device/:id/interfaces')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDeviceInterfaces(@Param('id') id: string) {
    const interfaces = await this.drilldownService.getDeviceInterfaces(id);
    return {
      success: true,
      data: interfaces,
    };
  }

  /**
   * Get interface details
   * GET /api/v1/monitoring/drilldown/interface/:id
   */
  @Get('interface/:id')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getInterfaceDetails(@Param('id', ParseIntPipe) id: number) {
    const details = await this.drilldownService.getInterfaceDetails(id);
    return {
      success: true,
      data: details,
    };
  }

  /**
   * Get performance summary across time ranges
   * GET /api/v1/monitoring/drilldown/device/:id/performance-summary
   */
  @Get('device/:id/performance-summary')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getPerformanceSummary(@Param('id') id: string) {
    const summary = await this.drilldownService.getPerformanceSummary(id);
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Health check
   * GET /api/v1/monitoring/drilldown/health
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'drilldown',
      status: 'operational',
    };
  }
}
