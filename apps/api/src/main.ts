import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3100'],
    credentials: true,
  });

  await app.listen(3100);
  console.log('NestJS API running on http://localhost:3100');
}
bootstrap();