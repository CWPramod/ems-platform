import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // CORS
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3100')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EMS Platform API')
    .setDescription('Enterprise Management System - REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication & session management')
    .addTag('licensing', 'License key management')
    .addTag('alerts', 'Alert lifecycle management')
    .addTag('security', 'SSL, IOC, Signatures, DDoS')
    .addTag('monitoring', 'Dashboard, Drilldown, Topology, Top Talkers')
    .addTag('masters', 'Customers, Devices, Thresholds')
    .addTag('reporting', 'Reports & Custom Dashboards')
    .addTag('cloud', 'AWS Cloud integration')
    .addTag('apm', 'Application Performance Monitoring')
    .addTag('assets', 'Asset management')
    .addTag('events', 'Event management')
    .addTag('metrics', 'Metrics collection')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3100);
  await app.listen(port);
  logger.log(`NestJS API running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
