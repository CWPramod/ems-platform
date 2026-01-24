// Monitoring Module (Updated)
// Organizes dashboard and drill-down services
// apps/api/src/monitoring/monitoring.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DrilldownService } from './drilldown/drilldown.service';
import { DrilldownController } from './drilldown/drilldown.controller';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceInterface } from '../entities/device-interface.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      DeviceHealth,
      DeviceInterface,
      DeviceMetricsHistory,
    ]),
  ],
  controllers: [DashboardController, DrilldownController],
  providers: [DashboardService, DrilldownService],
  exports: [DashboardService, DrilldownService],
})
export class MonitoringModule {}
