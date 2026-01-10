import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetsModule } from './assets/assets.module';
import { MetricsModule } from './metrics/metrics.module';
import { EventsModule } from './events/events.module';

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
      synchronize: true, // Auto-create tables (DEV ONLY - disable in production)
      logging: true, // See SQL queries in console
    }),

    AssetsModule,

    MetricsModule,

    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}