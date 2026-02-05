import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { SslCertificate } from '../entities/ssl-certificate.entity';
import { IocEntry } from '../entities/ioc-entry.entity';
import { SignatureAlert } from '../entities/signature-alert.entity';
import { DdosEvent } from '../entities/ddos-event.entity';

// Services
import { SslAnalysisService } from './services/ssl-analysis.service';
import { IocMonitoringService } from './services/ioc-monitoring.service';
import { SignatureDetectionService } from './services/signature-detection.service';
import { DdosDetectionService } from './services/ddos-detection.service';
import { SecuritySimulatorService } from './services/security-simulator.service';

// Controller
import { SecurityController } from './security.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SslCertificate,
      IocEntry,
      SignatureAlert,
      DdosEvent,
    ]),
  ],
  controllers: [SecurityController],
  providers: [
    SslAnalysisService,
    IocMonitoringService,
    SignatureDetectionService,
    DdosDetectionService,
    SecuritySimulatorService,
  ],
  exports: [
    SslAnalysisService,
    IocMonitoringService,
    SignatureDetectionService,
    DdosDetectionService,
  ],
})
export class SecurityModule {}
