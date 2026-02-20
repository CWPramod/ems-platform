import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaService } from '../src/sla/sla.service';
import { SlaEngineService } from '../src/sla/sla-engine.service';
import { RedisPublisherService } from '../src/events/redis-publisher.service';
import { Ticket } from '../src/tickets/entities/ticket.entity';
import { TicketHistory } from '../src/tickets/entities/ticket-history.entity';
import { SlaPolicy } from '../src/sla/entities/sla-policy.entity';

describe('SlaEngineService', () => {
  let slaService: SlaService;

  const mockTicketRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0', breached: '0' }),
    }),
    manager: { query: jest.fn().mockResolvedValue([{ mtta: null }]) },
  };

  const mockSlaPolicyRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data) => data),
    save: jest.fn((data) => ({ id: 'policy-1', ...data })),
  };

  const mockHistoryRepo = {
    save: jest.fn(),
    create: jest.fn((data) => data),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockRedisPublisher = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getRepositoryToken(Ticket), useValue: mockTicketRepo },
        { provide: getRepositoryToken(SlaPolicy), useValue: mockSlaPolicyRepo },
        { provide: getRepositoryToken(TicketHistory), useValue: mockHistoryRepo },
        { provide: RedisPublisherService, useValue: mockRedisPublisher },
      ],
    }).compile();

    slaService = module.get<SlaService>(SlaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('assignSlaPolicy', () => {
    it('should assign SLA policy and calculate due date', async () => {
      const policy = {
        id: 'policy-1',
        name: 'Critical SLA',
        severity: 'critical',
        resolutionTimeMinutes: 60,
      };
      mockSlaPolicyRepo.findOne.mockResolvedValue(policy);

      const ticket = {
        id: 'ticket-1',
        ticketNumber: 'INC-20260220-0001',
        severity: 'critical',
        createdAt: new Date(),
      } as Ticket;

      await slaService.assignSlaPolicy(ticket);

      expect(mockTicketRepo.update).toHaveBeenCalledWith(
        'ticket-1',
        expect.objectContaining({
          slaPolicyId: 'policy-1',
          slaDueAt: expect.any(Date),
        }),
      );
    });

    it('should handle missing SLA policy gracefully', async () => {
      mockSlaPolicyRepo.findOne.mockResolvedValue(null);

      const ticket = {
        id: 'ticket-1',
        ticketNumber: 'INC-20260220-0001',
        severity: 'unknown',
        createdAt: new Date(),
      } as Ticket;

      await slaService.assignSlaPolicy(ticket);
      expect(mockTicketRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('SLA pause/resume', () => {
    it('should pause SLA by recording pendingSince', () => {
      const ticket = { pendingSince: null } as Ticket;
      slaService.pauseSla(ticket);
      expect(ticket.pendingSince).toBeInstanceOf(Date);
    });

    it('should resume SLA and accumulate pending duration', () => {
      const pendingSince = new Date(Date.now() - 60000); // 1 minute ago
      const ticket = {
        pendingSince,
        pendingDurationMs: 0,
        slaDueAt: new Date(Date.now() + 3600000), // 1 hour from now
      } as Ticket;

      slaService.resumeSla(ticket);

      expect(ticket.pendingSince).toBeNull();
      expect(ticket.pendingDurationMs).toBeGreaterThanOrEqual(59000); // ~60s
      expect(ticket.pendingDurationMs).toBeLessThanOrEqual(61000);
    });

    it('should shift slaDueAt forward on resume', () => {
      const originalDue = new Date(Date.now() + 3600000);
      const pendingSince = new Date(Date.now() - 120000); // 2 minutes ago
      const ticket = {
        pendingSince,
        pendingDurationMs: 0,
        slaDueAt: new Date(originalDue),
      } as Ticket;

      slaService.resumeSla(ticket);

      // slaDueAt should be shifted forward by ~2 minutes
      const shiftMs = ticket.slaDueAt.getTime() - originalDue.getTime();
      expect(shiftMs).toBeGreaterThanOrEqual(119000);
      expect(shiftMs).toBeLessThanOrEqual(121000);
    });
  });

  describe('calculateElapsedMinutes', () => {
    it('should calculate elapsed time excluding pending', () => {
      const ticket = {
        createdAt: new Date(Date.now() - 600000), // 10 minutes ago
        pendingDurationMs: 120000, // 2 minutes pending
        pendingSince: null,
      } as Ticket;

      const elapsed = slaService.calculateElapsedMinutes(ticket);
      // ~8 minutes (10 - 2)
      expect(elapsed).toBeGreaterThanOrEqual(7.9);
      expect(elapsed).toBeLessThanOrEqual(8.1);
    });

    it('should account for currently pending time', () => {
      const ticket = {
        createdAt: new Date(Date.now() - 600000), // 10 minutes ago
        pendingDurationMs: 0,
        pendingSince: new Date(Date.now() - 300000), // pending for 5 minutes
      } as Ticket;

      const elapsed = slaService.calculateElapsedMinutes(ticket);
      // ~5 minutes (10 - 5 current pending)
      expect(elapsed).toBeGreaterThanOrEqual(4.9);
      expect(elapsed).toBeLessThanOrEqual(5.1);
    });
  });
});
