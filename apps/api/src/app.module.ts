import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: (configService.get<number>('THROTTLE_TTL', 60)) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
      inject: [ConfigService],
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
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
