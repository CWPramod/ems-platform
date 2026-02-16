import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { getProbeConfig } from './config.js';

async function bootstrap() {
  const logger = new Logger('ProbeAgent');
  const config = getProbeConfig();

  const app = await NestFactory.create(AppModule);

  // Simple health endpoint
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      probeId: config.probeId,
      target: config.emsApiUrl,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  await app.listen(config.probePort);
  logger.log(`Probe Agent "${config.probeId}" running on port ${config.probePort}`);
  logger.log(`Health check: http://localhost:${config.probePort}/health`);
}

bootstrap();
