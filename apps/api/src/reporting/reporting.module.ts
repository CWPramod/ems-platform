// Reporting Module
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';
import { CustomDashboardsService } from './dashboards/custom-dashboards.service';
import { CustomDashboardsController } from './dashboards/custom-dashboards.controller';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';
import { ReportDefinition } from '../entities/report-definition.entity';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { ReportHistory } from '../entities/report-history.entity';
import { DashboardConfig } from '../entities/dashboard-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      DeviceHealth,
      DeviceMetricsHistory,
      ReportDefinition,
      ReportSchedule,
      ReportHistory,
      DashboardConfig,
    ]),
  ],
  controllers: [ReportsController, CustomDashboardsController],
  providers: [ReportsService, CustomDashboardsService],
  exports: [ReportsService, CustomDashboardsService],
})
export class ReportingModule {}