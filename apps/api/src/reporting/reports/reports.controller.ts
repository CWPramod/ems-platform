// Reports Controller
// REST API endpoints for report generation and management
// apps/api/src/reporting/reports/reports.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@ApiTags('reporting')
@Controller('api/v1/reporting/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Generate SLA Report
   * POST /api/v1/reporting/reports/sla
   */
  @Post('sla')
  @Permissions('reports:read')
  @UseGuards(RbacGuard)
  async generateSLAReport(
    @Body() body: {
      startDate: string;
      endDate: string;
      tier?: number;
      location?: string;
      deviceType?: string;
    },
    @Request() req: any,
  ) {
    const params = {
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      tier: body.tier,
      location: body.location,
      deviceType: body.deviceType,
    };

    const report = await this.reportsService.generateSLAReport(params);
    
    return {
      success: true,
      data: report,
    };
  }

  /**
   * Generate Uptime Report
   * POST /api/v1/reporting/reports/uptime
   */
  @Post('uptime')
  @Permissions('reports:read')
  @UseGuards(RbacGuard)
  async generateUptimeReport(
    @Body() body: {
      startDate: string;
      endDate: string;
      tier?: number;
      location?: string;
    },
  ) {
    const params = {
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      tier: body.tier,
      location: body.location,
    };

    const report = await this.reportsService.generateUptimeReport(params);
    
    return {
      success: true,
      data: report,
    };
  }

  /**
   * Generate Performance Report
   * POST /api/v1/reporting/reports/performance
   */
  @Post('performance')
  @Permissions('reports:read')
  @UseGuards(RbacGuard)
  async generatePerformanceReport(
    @Body() body: {
      startDate: string;
      endDate: string;
      tier?: number;
      location?: string;
      deviceType?: string;
    },
  ) {
    const params = {
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      tier: body.tier,
      location: body.location,
      deviceType: body.deviceType,
    };

    const report = await this.reportsService.generatePerformanceReport(params);
    
    return {
      success: true,
      data: report,
    };
  }

  /**
   * Generate Traffic Report
   * POST /api/v1/reporting/reports/traffic
   */
  @Post('traffic')
  @Permissions('reports:read')
  @UseGuards(RbacGuard)
  async generateTrafficReport(
    @Body() body: {
      startDate: string;
      endDate: string;
      tier?: number;
      location?: string;
      deviceType?: string;
    },
  ) {
    const params = {
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      tier: body.tier,
      location: body.location,
      deviceType: body.deviceType,
    };

    const report = await this.reportsService.generateTrafficReport(params);

    return {
      success: true,
      data: report,
    };
  }

  /**
   * Get Report History
   * GET /api/v1/reporting/reports/history?limit=50
   */
  @Get('history')
  @Permissions('reports:read')
  @UseGuards(RbacGuard)
  async getReportHistory(
    @Query('reportDefId') reportDefId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};

    if (reportDefId) {
      filters.reportDefId = parseInt(reportDefId);
    }

    if (limit) {
      filters.limit = parseInt(limit);
    }

    const history = await this.reportsService.getReportHistory(filters);

    // Transform to match frontend expectations
    const transformedHistory = history.map((h) => ({
      id: h.id,
      type: h.reportType,
      name: h.reportName,
      format: h.format,
      status: h.status,
      startDate: h.parameters?.startDate,
      endDate: h.parameters?.endDate,
      tier: h.parameters?.tier || 'All',
      location: h.parameters?.location || 'All Locations',
      totalDevices: h.rowCount,
      compliance: h.parameters?.compliance,
      avgUptime: h.parameters?.avgUptime,
      generatedAt: h.createdAt,
      durationSeconds: h.durationSeconds,
    }));

    return {
      success: true,
      data: transformedHistory,
      count: transformedHistory.length,
    };
  }

  /**
   * Health check
   * GET /api/v1/reporting/reports/health
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'reports',
      status: 'operational',
    };
  }
}
