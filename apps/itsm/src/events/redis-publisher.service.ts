import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

const STREAM_KEY = 'ems:itsm:stream';

@Injectable()
export class RedisPublisherService {
  private readonly logger = new Logger(RedisPublisherService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    try {
      await this.redis.xadd(
        STREAM_KEY,
        '*',
        'event_type', eventType,
        'data', JSON.stringify(data),
        'timestamp', new Date().toISOString(),
      );
      this.logger.debug(`Published event: ${eventType}`);
    } catch (err: any) {
      this.logger.error(`Failed to publish event ${eventType}: ${err.message}`);
    }
  }
}
