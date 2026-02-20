import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';
import { TicketsService } from '../tickets/tickets.service';
import { CommentsService } from '../comments/comments.service';

const STREAM_KEY = 'ems:alerts:stream';
const GROUP_NAME = 'itsm-consumer-group';
const CONSUMER_NAME = `itsm-worker-${process.pid}`;

@Injectable()
export class RedisConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisConsumerService.name);
  private running = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly ticketsService: TicketsService,
    private readonly commentsService: CommentsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConsumerGroup();
    this.running = true;
    this.consumeLoop();
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
      this.logger.log(`Consumer group '${GROUP_NAME}' created on '${STREAM_KEY}'`);
    } catch (err: any) {
      if (err.message?.includes('BUSYGROUP')) {
        this.logger.log(`Consumer group '${GROUP_NAME}' already exists`);
      } else {
        this.logger.error(`Failed to create consumer group: ${err.message}`);
      }
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', GROUP_NAME, CONSUMER_NAME,
          'COUNT', '10',
          'BLOCK', '5000',
          'STREAMS', STREAM_KEY, '>',
        ) as [string, [string, string[]][]][] | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            await this.processAlert(messageId, fields);
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error(`Consumer error: ${err.message}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }

  private async processAlert(messageId: string, fields: string[]): Promise<void> {
    // Parse fields array into object
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }

    const severity = data.severity?.toLowerCase();
    const alertId = data.alertId || data.alert_id || data.id;

    // Only auto-create tickets for critical/high alerts
    if (severity !== 'critical' && severity !== 'high') {
      this.logger.debug(`Skipping ${severity} alert ${alertId}`);
      await this.redis.xack(STREAM_KEY, GROUP_NAME, messageId);
      return;
    }

    // Dedup: check if ticket already exists for this alert
    if (alertId) {
      const existing = await this.ticketsService.findByAlertId(alertId);
      if (existing && existing.status !== 'closed') {
        this.logger.log(`Ticket already exists for alert ${alertId}: ${existing.ticketNumber}`);

        // If alert auto-resolved, add a comment but don't close
        if (data.status === 'resolved' || data.status === 'auto_resolved') {
          await this.commentsService.create(existing.id, {
            comment: `Alert ${alertId} auto-resolved. Please verify before closing ticket.`,
            visibility: 'internal',
          }, 'system');
        }

        await this.redis.xack(STREAM_KEY, GROUP_NAME, messageId);
        return;
      }
    }

    try {
      const ticket = await this.ticketsService.create(
        {
          title: data.title || data.message || `Auto-ticket from alert ${alertId}`,
          description: data.description || data.details || `Automatically created from ${severity} alert.`,
          type: 'incident',
          severity: severity,
          priority: severity === 'critical' ? 'P1' : 'P2',
          alertId: alertId,
          assetId: data.assetId || data.asset_id,
          source: 'auto_alert',
        },
        'system',
      );

      this.logger.log(`Auto-created ticket ${ticket.ticketNumber} from alert ${alertId}`);
      await this.redis.xack(STREAM_KEY, GROUP_NAME, messageId);
    } catch (err: any) {
      this.logger.error(`Failed to create ticket from alert ${alertId}: ${err.message}`);
    }
  }
}
