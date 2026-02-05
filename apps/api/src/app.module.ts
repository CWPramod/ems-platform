import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { MastersModule } from './masters/masters.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ReportingModule } from './reporting/reporting.module';
import { AssetsModule } from './assets/assets.module';
import { MetricsModule } from './metrics/metrics.module';
import { EventsModule } from './events/events.module';
import { AlertsModule } from './alerts/alerts.module';
import { CloudModule } from './cloud/cloud.module';
import { ApmModule } from './apm/apm.module';
import { SecurityModule } from './security/security.module';
import { LicensingModule } from './licensing/licensing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5433', 10),
      username: process.env.DATABASE_USER || 'ems_admin',
      password: process.env.DATABASE_PASSWORD || 'ems_secure_password_2026',
      database: process.env.DATABASE_NAME || 'ems_platform',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: true,
    }),
    // Schedule module for cron jobs (session cleanup, etc.)
    ScheduleModule.forRoot(),
    // Authentication & Authorization
    AuthModule,
    RbacModule,
    // Masters Module (Customers, Devices, etc.)
    MastersModule,
    // Monitoring Module (Dashboard, Drilldown, Topology, Top Talkers)
    MonitoringModule,
    // Reporting Module (Reports, Custom Dashboards)
    ReportingModule,
    // Existing Modules
    AssetsModule,
    MetricsModule,
    EventsModule,
    AlertsModule,
    CloudModule,
    ApmModule,
    // Security Module (SSL, IOC, Signatures, DDoS)
    SecurityModule,
    // Licensing Module (license validation, feature gating, trial provisioning)
    LicensingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
