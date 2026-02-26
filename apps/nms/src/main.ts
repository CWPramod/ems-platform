import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NmsModule } from './nms.module';

async function bootstrap() {
  const app = await NestFactory.create(NmsModule);

  // Enable CORS for EMS Core communication
  app.enableCors({
    origin: ['http://localhost:3100', 'http://localhost:5173'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'nms',
      port: 3001,
      timestamp: new Date().toISOString(),
    });
  });

  const port = process.env.NMS_PORT || 3001;
  await app.listen(port);
  
  const pollingEnabled = process.env.NMS_POLLING_ENABLED !== 'false';
  const emsCoreUrl = process.env.EMS_CORE_URL || 'http://localhost:3100';

  console.log('');
  console.log('==============================================================');
  console.log('  NMS Module (Network Management / SNMP Discovery)');
  console.log('==============================================================');
  console.log(`  Status:       Running`);
  console.log(`  Port:         ${port}`);
  console.log(`  EMS Core:     ${emsCoreUrl}`);
  console.log(`  Polling:      ${pollingEnabled ? 'ENABLED (30s interval)' : 'DISABLED (discovery-only)'}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /health                        - Health check');
  console.log('    GET  /api/v1/nms/status             - NMS module status');
  console.log('    POST /api/v1/nms/discover           - Start subnet auto-discovery');
  console.log('    GET  /api/v1/nms/discover/status    - Discovery job status');
  console.log('    GET  /api/v1/nms/metrics            - Current metrics');
  console.log('');
  if (pollingEnabled) {
    console.log('  Background Jobs:');
    console.log('    * Device polling (every 30 seconds)');
    console.log('    * Metric collection (every 30 seconds)');
    console.log('    * Event emission to EMS Core');
  } else {
    console.log('  Polling disabled - API module handles SNMP polling.');
    console.log('  Set NMS_POLLING_ENABLED=true to enable NMS polling.');
  }
  console.log('==============================================================');
  console.log('');
}

bootstrap().catch((err) => {
  console.error('Failed to start NMS module:', err);
  process.exit(1);
});
