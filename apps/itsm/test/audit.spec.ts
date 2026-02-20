import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketsService } from '../src/tickets/tickets.service';
import { Ticket } from '../src/tickets/entities/ticket.entity';
import { TicketHistory } from '../src/tickets/entities/ticket-history.entity';
import { TicketLink } from '../src/tickets/entities/ticket-link.entity';
import { TicketNumberGenerator } from '../src/common/utils/ticket-number.generator';
import { SlaService } from '../src/sla/sla.service';
import { RedisPublisherService } from '../src/events/redis-publisher.service';

describe('Audit Trail', () => {
  let ticketsService: TicketsService;
  let historyRepo: any;

  const mockTicket = {
    id: 'ticket-1',
    ticketNumber: 'INC-20260220-0001',
    title: 'Test Ticket',
    status: 'open',
    severity: 'critical',
    priority: 'P1',
    type: 'incident',
    createdBy: '1',
    assignedTo: null,
    resolutionNotes: null,
    pendingSince: null,
    pendingDurationMs: 0,
    slaDueAt: new Date(),
    alertId: null,
  };

  const ticketRepo = {
    create: jest.fn((data) => ({ ...mockTicket, ...data })),
    save: jest.fn((data) => Promise.resolve({ ...mockTicket, ...data })),
    findOne: jest.fn().mockResolvedValue({ ...mockTicket }),
  };

  beforeEach(async () => {
    historyRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'history-1', ...data })),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketHistory), useValue: historyRepo },
        { provide: getRepositoryToken(TicketLink), useValue: {} },
        { provide: TicketNumberGenerator, useValue: { generate: jest.fn().mockResolvedValue('INC-20260220-0001') } },
        { provide: SlaService, useValue: { assignSlaPolicy: jest.fn(), pauseSla: jest.fn(), resumeSla: jest.fn() } },
        { provide: RedisPublisherService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should record status change in ticket_history', async () => {
    ticketRepo.findOne.mockResolvedValueOnce({ ...mockTicket, status: 'open' });

    await ticketsService.updateStatus('ticket-1', { status: 'acknowledged' }, 'user-1');

    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket-1',
        fieldChanged: 'status',
        oldValue: 'open',
        newValue: 'acknowledged',
        changedBy: 'user-1',
      }),
    );
  });

  it('should record assignment change in ticket_history', async () => {
    ticketRepo.findOne.mockResolvedValueOnce({ ...mockTicket });

    await ticketsService.assign('ticket-1', { assignedTo: 'operator-1' }, 'user-1');

    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket-1',
        fieldChanged: 'assigned_to',
        oldValue: '',
        newValue: 'operator-1',
        changedBy: 'user-1',
      }),
    );
  });

  it('should record multiple status transitions', async () => {
    // open → acknowledged
    ticketRepo.findOne.mockResolvedValueOnce({ ...mockTicket, status: 'open' });
    await ticketsService.updateStatus('ticket-1', { status: 'acknowledged' }, 'user-1');

    // acknowledged → in_progress
    ticketRepo.findOne.mockResolvedValueOnce({ ...mockTicket, status: 'acknowledged' });
    await ticketsService.updateStatus('ticket-1', { status: 'in_progress' }, 'user-1');

    expect(historyRepo.save).toHaveBeenCalledTimes(2);
    expect(historyRepo.save).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ fieldChanged: 'status', oldValue: 'open', newValue: 'acknowledged' }),
    );
    expect(historyRepo.save).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ fieldChanged: 'status', oldValue: 'acknowledged', newValue: 'in_progress' }),
    );
  });
});
