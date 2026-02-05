// Top Talkers Controller
// REST API endpoints for traffic analysis and top talkers
// apps/api/src/monitoring/top-talkers/top-talkers.controller.ts

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TopTalkersService } from './top-talkers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@ApiTags('monitoring')
@Controller('api/v1/monitoring/top-talkers')
@UseGuards(JwtAuthGuard)
export class TopTalkersController {
  constructor(private readonly topTalkersService: TopTalkersService) {}

  /**
   * Get top talkers by bandwidth
   * GET /api/v1/monitoring/top-talkers?limit=10&timeRange=1h&metric=bytes
   */
  @Get()
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopTalkers(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
    @Query('metric') metric?: 'bytes' | 'packets',
  ) {
    const topTalkers = await this.topTalkersService.getTopTalkers(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
      metric || 'bytes',
    );
    return {
      success: true,
      data: topTalkers,
    };
  }

  /**
   * Get top conversations
   * GET /api/v1/monitoring/top-talkers/conversations?limit=10&timeRange=1h
   */
  @Get('conversations')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopConversations(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const conversations = await this.topTalkersService.getTopConversations(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return {
      success: true,
      data: conversations,
    };
  }

  /**
   * Get top protocols
   * GET /api/v1/monitoring/top-talkers/protocols?limit=10&timeRange=1h
   */
  @Get('protocols')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopProtocols(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const protocols = await this.topTalkersService.getTopProtocols(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return {
      success: true,
      data: protocols,
    };
  }

  /**
   * Get top interfaces by traffic
   * GET /api/v1/monitoring/top-talkers/interfaces?limit=10&timeRange=1h
   */
  @Get('interfaces')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopInterfaces(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const interfaces = await this.topTalkersService.getTopInterfaces(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return {
      success: true,
      data: interfaces,
    };
  }

  /**
   * Get top source IPs (top senders)
   * GET /api/v1/monitoring/top-talkers/source-ips?limit=10&timeRange=1h
   */
  @Get('source-ips')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopSourceIPs(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const data = await this.topTalkersService.getTopSourceIPs(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return { success: true, data };
  }

  /**
   * Get top destination IPs (top receivers)
   * GET /api/v1/monitoring/top-talkers/destination-ips?limit=10&timeRange=1h
   */
  @Get('destination-ips')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopDestinationIPs(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const data = await this.topTalkersService.getTopDestinationIPs(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return { success: true, data };
  }

  /**
   * Get top applications (by port)
   * GET /api/v1/monitoring/top-talkers/applications?limit=10&timeRange=1h
   */
  @Get('applications')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTopApplications(
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const data = await this.topTalkersService.getTopApplications(
      limit ? parseInt(limit) : 10,
      timeRange || '1h',
    );
    return { success: true, data };
  }

  /**
   * Get device traffic details
   * GET /api/v1/monitoring/top-talkers/device/:id?timeRange=24h
   */
  @Get('device/:id')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getDeviceTraffic(
    @Param('id') id: string,
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const traffic = await this.topTalkersService.getDeviceTraffic(
      id,
      timeRange || '24h',
    );
    
    if (!traffic) {
      return {
        success: false,
        message: 'Device not found',
      };
    }

    return {
      success: true,
      data: traffic,
    };
  }

  /**
   * Get traffic statistics
   * GET /api/v1/monitoring/top-talkers/stats?timeRange=24h
   */
  @Get('stats/overview')
  @Permissions('dashboard:read')
  @UseGuards(RbacGuard)
  async getTrafficStats(
    @Query('timeRange') timeRange?: '1h' | '24h' | '7d',
  ) {
    const stats = await this.topTalkersService.getTrafficStats(
      timeRange || '24h',
    );
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Health check
   * GET /api/v1/monitoring/top-talkers/health
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'top-talkers',
      status: 'operational',
    };
  }
}
