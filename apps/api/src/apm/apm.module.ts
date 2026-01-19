import { Module } from '@nestjs/common';
import { APMController } from './controllers/apm.controller';
import { HealthService } from './services/health.service';
import { MetricsService } from './services/metrics.service';
import { TransactionService } from './services/transaction.service';

@Module({
  controllers: [APMController],
  providers: [HealthService, MetricsService, TransactionService],
  exports: [HealthService, MetricsService, TransactionService],
})
export class ApmModule {}