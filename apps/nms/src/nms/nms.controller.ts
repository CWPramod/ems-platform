import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { NmsOrchestrationService } from './nms-orchestration.service';
import { DiscoveryService } from '../discovery/discovery.service';

interface DiscoverBody {
  subnets: string[];
  community?: string;
}

interface DiscoverByIPsBody {
  ips: string[];
  community?: string;
}

@Controller('api/v1/nms')
export class NmsController {
  constructor(
    private readonly nmsService: NmsOrchestrationService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  @Get('status')
  getStatus() {
    return this.nmsService.getStatus();
  }

  @Post('discover')
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscovery(@Body() body: DiscoverBody) {
    if (!body.subnets || !Array.isArray(body.subnets) || body.subnets.length === 0) {
      throw new BadRequestException(
        'subnets is required and must be a non-empty array of CIDR strings (e.g. ["10.0.1.0/24"])',
      );
    }

    // Validate each CIDR format
    const cidrRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    for (const subnet of body.subnets) {
      if (!cidrRegex.test(subnet)) {
        throw new BadRequestException(
          `Invalid CIDR notation: "${subnet}". Expected format: "10.0.1.0/24"`,
        );
      }
    }

    try {
      const job = await this.discoveryService.startDiscovery(
        body.subnets,
        body.community || 'public',
      );

      return {
        jobId: job.jobId,
        message: `Discovery started for ${body.subnets.length} subnet(s)`,
        totalIPs: job.totalIPs,
        subnets: body.subnets,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('discover/ips')
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscoveryByIPs(@Body() body: DiscoverByIPsBody) {
    if (!body.ips || !Array.isArray(body.ips) || body.ips.length === 0) {
      throw new BadRequestException(
        'ips is required and must be a non-empty array of IP addresses (e.g. ["10.0.1.1", "10.0.1.2"])',
      );
    }

    // Validate each IP format (no CIDR, plain IPs only)
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    for (const ip of body.ips) {
      if (!ipRegex.test(ip)) {
        throw new BadRequestException(
          `Invalid IP address: "${ip}". Expected format: "10.0.1.1" (no CIDR notation)`,
        );
      }
    }

    try {
      const job = await this.discoveryService.startDiscoveryByIPs(
        body.ips,
        body.community || 'public',
      );

      return {
        jobId: job.jobId,
        message: `Discovery started for ${job.totalIPs} targeted IP(s)`,
        totalIPs: job.totalIPs,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Get('discover/status')
  getDiscoveryStatus(@Query('jobId') jobId?: string) {
    const job = this.discoveryService.getJob(jobId);

    if (!job) {
      return {
        message: jobId
          ? `No discovery job found with ID: ${jobId}`
          : 'No discovery jobs have been started',
        status: 'not_found',
      };
    }

    return {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      totalIPs: job.totalIPs,
      scannedIPs: job.scannedIPs,
      devicesFound: job.devicesFound,
      subnets: job.subnets,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      devices: job.devices.map((d) => ({
        ip: d.ip,
        sysName: d.sysName,
        vendor: d.vendor,
        deviceType: d.deviceType,
        model: d.model,
        interfaceCount: d.interfaces.length,
        assetId: d.assetId,
        skipped: d.skipped,
        skipReason: d.skipReason,
      })),
    };
  }

  @Get('metrics')
  getCurrentMetrics() {
    const status = this.nmsService.getStatus();

    return {
      reachableDevices: status.reachableDevices,
      unreachableDevices: status.unreachableDevices,
      totalDevices: status.totalDevices,
      pollingStatus: status.isPolling ? 'active' : 'idle',
    };
  }
}
