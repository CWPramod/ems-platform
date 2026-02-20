import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = configService.get<number>('REDIS_PORT', 6379);

    return new Redis({
      host,
      port,
      maxRetriesPerRequest: null, // Required for blocking reads
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
  },
  inject: [ConfigService],
};
