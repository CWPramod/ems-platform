import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertStatus } from '../entities/alert.entity';
import { createMockAlert } from '../test-utils/mock-entities.factory';

describe('AlertsController', () => {
  let controller: AlertsController;
  let alertsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    alertsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      acknowledge: jest.fn(),
      resolve: jest.fn(),
      close: jest.fn(),
      updateBusinessImpact: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [{ provide: AlertsService, useValue: alertsService }],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  it('should delegate create to service', async () => {
    const alert = createMockAlert();
    alertsService.create.mockResolvedValue(alert);

    const result = await controller.create({ eventId: 'evt-1' } as any);

    expect(alertsService.create).toHaveBeenCalledWith({ eventId: 'evt-1' });
    expect(result).toBe(alert);
  });

  it('should delegate findAll with parsed filters', async () => {
    alertsService.findAll.mockResolvedValue({ data: [], total: 0 });

    await controller.findAll(AlertStatus.OPEN, undefined, undefined, undefined, '10', '0');

    expect(alertsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: AlertStatus.OPEN, limit: 10, offset: 0 }),
    );
  });

  it('should delegate findOne to service', async () => {
    const alert = createMockAlert();
    alertsService.findOne.mockResolvedValue(alert);

    const result = await controller.findOne('id-1');

    expect(alertsService.findOne).toHaveBeenCalledWith('id-1');
    expect(result).toBe(alert);
  });

  it('should delegate acknowledge to service', async () => {
    const alert = createMockAlert({ status: AlertStatus.ACKNOWLEDGED });
    alertsService.acknowledge.mockResolvedValue(alert);

    const result = await controller.acknowledge('id-1', { owner: 'admin' });

    expect(alertsService.acknowledge).toHaveBeenCalledWith('id-1', 'admin');
    expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
  });

  it('should delegate resolve to service', async () => {
    const dto = { resolutionNotes: 'Fixed' };
    alertsService.resolve.mockResolvedValue(createMockAlert({ status: AlertStatus.RESOLVED }));

    await controller.resolve('id-1', dto);

    expect(alertsService.resolve).toHaveBeenCalledWith('id-1', dto);
  });

  it('should delegate close to service', async () => {
    alertsService.close.mockResolvedValue(createMockAlert({ status: AlertStatus.CLOSED }));

    await controller.close('id-1');

    expect(alertsService.close).toHaveBeenCalledWith('id-1');
  });

  it('should delegate updateBusinessImpact to service', async () => {
    const dto = { businessImpactScore: 80, affectedUsers: 100 };
    alertsService.updateBusinessImpact.mockResolvedValue(createMockAlert());

    await controller.updateBusinessImpact('id-1', dto as any);

    expect(alertsService.updateBusinessImpact).toHaveBeenCalledWith('id-1', dto);
  });
});
