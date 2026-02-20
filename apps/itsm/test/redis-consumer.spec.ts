import { Test, TestingModule } from '@nestjs/testing';
import { RedisConsumerService } from '../src/events/redis-consumer.service';
import { TicketsService } from '../src/tickets/tickets.service';
import { CommentsService } from '../src/comments/comments.service';
import { REDIS_CLIENT } from '../src/events/redis.provider';

describe('RedisConsumerService', () => {
  let consumerService: RedisConsumerService;
  let ticketsService: jest.Mocked<Partial<TicketsService>>;

  const mockRedis = {
    xgroup: jest.fn().mockResolvedValue('OK'),
    xreadgroup: jest.fn().mockResolvedValue(null),
    xack: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    ticketsService = {
      findByAlertId: jest.fn(),
      create: jest.fn(),
    };

    const commentsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisConsumerService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: TicketsService, useValue: ticketsService },
        { provide: CommentsService, useValue: commentsService },
      ],
    }).compile();

    consumerService = module.get<RedisConsumerService>(RedisConsumerService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('ensureConsumerGroup', () => {
    it('should create consumer group on init', async () => {
      await consumerService.onModuleInit();
      expect(mockRedis.xgroup).toHaveBeenCalledWith(
        'CREATE',
        'ems:alerts:stream',
        'itsm-consumer-group',
        '0',
        'MKSTREAM',
      );
      consumerService.onModuleDestroy();
    });

    it('should handle BUSYGROUP error gracefully', async () => {
      mockRedis.xgroup.mockRejectedValueOnce(
        new Error('BUSYGROUP Consumer Group name already exists'),
      );
      await consumerService.onModuleInit();
      // Should not throw
      consumerService.onModuleDestroy();
    });
  });

  describe('deduplication', () => {
    it('should skip creation when ticket exists for alert', async () => {
      ticketsService.findByAlertId.mockResolvedValue({
        id: 'existing-ticket',
        ticketNumber: 'INC-20260220-0001',
        status: 'open',
      } as any);

      // Manually invoke the private processAlert method via reflection
      const processAlert = (consumerService as any).processAlert.bind(consumerService);
      await processAlert('msg-1', [
        'severity', 'critical',
        'alertId', 'alert-1',
        'title', 'Test Alert',
      ]);

      expect(ticketsService.create).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalled();
    });

    it('should create ticket when no existing ticket for alert', async () => {
      ticketsService.findByAlertId.mockResolvedValue(null);
      ticketsService.create.mockResolvedValue({
        id: 'new-ticket',
        ticketNumber: 'INC-20260220-0002',
      } as any);

      const processAlert = (consumerService as any).processAlert.bind(consumerService);
      await processAlert('msg-2', [
        'severity', 'critical',
        'alertId', 'alert-2',
        'title', 'Critical Alert',
      ]);

      expect(ticketsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'incident',
          severity: 'critical',
          priority: 'P1',
          alertId: 'alert-2',
          source: 'auto_alert',
        }),
        'system',
      );
    });

    it('should skip low-severity alerts', async () => {
      const processAlert = (consumerService as any).processAlert.bind(consumerService);
      await processAlert('msg-3', [
        'severity', 'warning',
        'alertId', 'alert-3',
        'title', 'Warning Alert',
      ]);

      expect(ticketsService.create).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalled();
    });
  });
});
