import { Module, forwardRef } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { RedisConsumerService } from './redis-consumer.service';
import { RedisPublisherService } from './redis-publisher.service';
import { TicketsModule } from '../tickets/tickets.module';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [
    forwardRef(() => TicketsModule),
    CommentsModule,
  ],
  providers: [redisProvider, RedisConsumerService, RedisPublisherService],
  exports: [RedisPublisherService, redisProvider],
})
export class EventsModule {}
