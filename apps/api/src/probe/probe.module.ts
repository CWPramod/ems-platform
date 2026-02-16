import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';
import { TrafficFlow } from '../entities/traffic-flow.entity';
import { ProbeController } from './probe.controller';
import { ProbeService } from './probe.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, DeviceHealth, DeviceMetricsHistory, TrafficFlow]),
  ],
  controllers: [ProbeController],
  providers: [ProbeService],
  exports: [ProbeService],
})
export class ProbeModule {}
