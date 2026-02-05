import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from '../entities/license.entity';
import { LicenseAuditLog } from '../entities/license-audit-log.entity';
import { Asset } from '../entities/asset.entity';
import { LicensingService } from './licensing.service';
import { LicenseKeyService } from './license-key.service';
import { LicenseValidationService } from './license-validation.service';
import { LicenseSchedulerService } from './license-scheduler.service';
import { LicensingController } from './licensing.controller';
import { LicenseGuard } from './license.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([License, LicenseAuditLog, Asset]),
  ],
  controllers: [LicensingController],
  providers: [
    LicensingService,
    LicenseKeyService,
    LicenseValidationService,
    LicenseSchedulerService,
    LicenseGuard,
  ],
  exports: [
    LicensingService,
    LicenseValidationService,
    LicenseGuard,
  ],
})
export class LicensingModule {}
