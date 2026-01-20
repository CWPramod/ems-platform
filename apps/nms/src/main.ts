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
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║          🌐 NMS Module (Network Management)                ║');
  console.log('║                                                            ║');
  console.log('║  Status: Running                                           ║');
  console.log(`║  Port: ${port}                                               ║`);
  console.log('║  Mode: Integrated with EMS Core                            ║');
  console.log('║  EMS Core API: http://localhost:3100                       ║');
  console.log('║                                                            ║');
  console.log('║  Endpoints:                                                ║');
  console.log('║    GET  /health           - Health check                   ║');
  console.log('║    GET  /nms/status       - NMS module status              ║');
  console.log('║    POST /nms/discover     - Trigger device discovery       ║');
  console.log('║    GET  /nms/metrics      - Current metrics                ║');
  console.log('║                                                            ║');
  console.log('║  Background Jobs:                                          ║');
  console.log('║    ✓ Device polling (every 5 minutes)                      ║');
  console.log('║    ✓ Metric collection (every 1 minute)                    ║');
  console.log('║    ✓ Event emission to EMS Core                            ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
}

bootstrap().catch((err) => {
  console.error('Failed to start NMS module:', err);
  process.exit(1);
});
