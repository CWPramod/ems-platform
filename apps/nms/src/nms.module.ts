import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NmsController } from './nms/nms.controller';
import { NmsOrchestrationService } from './nms/nms-orchestration.service';
import { EmsCoreClient } from './ems-core/ems-core.client';
import { SnmpPollingService } from './snmp/snmp-polling.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
  ],
  controllers: [NmsController],
  providers: [
    NmsOrchestrationService,
    EmsCoreClient,
    SnmpPollingService,
  ],
  exports: [],
})
export class NmsModule {}
