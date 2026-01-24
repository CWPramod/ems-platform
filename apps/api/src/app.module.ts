import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './assets/assets.module';
import { MetricsModule } from './metrics/metrics.module';
import { EventsModule } from './events/events.module';
import { AlertsModule } from './alerts/alerts.module';
import { CloudModule } from './cloud/cloud.module';
import { ApmModule } from './apm/apm.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { MastersModule } from './masters/masters.module';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Configure TypeORM with PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5433', 10),
      username: process.env.DATABASE_USER || 'ems_admin',
      password: process.env.DATABASE_PASSWORD || 'ems_secure_password_2026',
      database: process.env.DATABASE_NAME || 'ems_platform',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: true,
    }),
    // Schedule module for cron jobs (session cleanup, etc.)
    ScheduleModule.forRoot(),
    // Authentication & Authorization
    AuthModule,
    RbacModule,
    // Masters Module (Customers, Devices, etc.)
    MastersModule,
    // Existing Modules
    AssetsModule,
    MetricsModule,
    EventsModule,
    AlertsModule,
    CloudModule,
    ApmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}