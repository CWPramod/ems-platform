// Thresholds Module
// apps/api/src/masters/thresholds/thresholds.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThresholdsService } from './thresholds.service';
import { ThresholdsController } from './thresholds.controller';
import { ThresholdRule } from '../../entities/threshold-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ThresholdRule])],
  controllers: [ThresholdsController],
  providers: [ThresholdsService],
  exports: [ThresholdsService],
})
export class ThresholdsModule {}
