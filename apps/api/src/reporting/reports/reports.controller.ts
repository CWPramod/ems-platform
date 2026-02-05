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
    
    return {
      success: true,
      data: history,
      count: history.length,
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
