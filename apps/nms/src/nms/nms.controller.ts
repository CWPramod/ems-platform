import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { NmsOrchestrationService } from './nms-orchestration.service';

@Controller('nms')
export class NmsController {
  constructor(private readonly nmsService: NmsOrchestrationService) {}

  @Get('status')
  getStatus() {
    return this.nmsService.getStatus();
  }

  @Post('discover')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerDiscovery() {
    // Trigger discovery asynchronously
    this.nmsService.triggerDiscovery().catch((err) => {
      console.error('Discovery failed:', err);
    });

    return {
      message: 'Discovery triggered',
      status: 'pending',
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
