import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../entities/alert.entity';
import { Event } from '../entities/event.entity';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertGeneratorService } from './alert-generator.service';
import { MLIntegrationService } from '../services/ml-integration.service';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Event, Asset, DeviceHealth])],
  controllers: [AlertsController],
  providers: [AlertsService, AlertGeneratorService, MLIntegrationService],
  exports: [AlertsService],
})
export class AlertsModule {}