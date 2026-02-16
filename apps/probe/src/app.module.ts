import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SnmpPollerService } from './snmp-poller.service.js';
import { ApiPusherService } from './api-pusher.service.js';
import { ProbeOrchestratorService } from './probe-orchestrator.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SnmpPollerService, ApiPusherService, ProbeOrchestratorService],
})
export class AppModule {}
