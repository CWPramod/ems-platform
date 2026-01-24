// Monitoring Module
// Organizes dashboard and monitoring services
// apps/api/src/monitoring/monitoring.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, DeviceHealth])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class MonitoringModule {}
