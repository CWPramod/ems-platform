import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { MLIntegrationService } from '../services/ml-integration.service';
import { createMockRepository, MockRepository } from '../test-utils/mock-repository.factory';
import { createMockAlert } from '../test-utils/mock-entities.factory';
import { createMockMLIntegrationService } from '../test-utils/mock-services.factory';

describe('AlertsService', () => {
  let service: AlertsService;
  let alertRepo: MockRepository;
  let mlService: ReturnType<typeof createMockMLIntegrationService>;
  let queryBuilder: any;

  beforeEach(async () => {
    alertRepo = createMockRepository();
    mlService = createMockMLIntegrationService();
    queryBuilder = alertRepo.createQueryBuilder!();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: alertRepo },
        { provide: MLIntegrationService, useValue: mlService },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  describe('create', () => {
    it('should set OPEN status on creation', async () => {
      mlService.isMLServiceAvailable.mockResolvedValue(false);

      await service.create({ eventId: 'evt-1' });

      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AlertStatus.OPEN }),
      );
      expect(alertRepo.save).toHaveBeenCalled();
    });

    it('should enhance with ML when available', async () => {
      mlService.isMLServiceAvailable.mockResolvedValue(true);
      mlService.calculateBusinessImpact.mockResolvedValue({
        business_impact_score: 85,
        affected_users: 1200,
        revenue_at_risk: 50000,
      });

      const alertData = { eventId: 'evt-1', rootCauseAssetId: 'asset-1' };
      alertRepo.create!.mockImplementation((d: any) => ({ ...d }));
      alertRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'a1', ...d }));

      const result = await service.create(alertData);

      expect(mlService.calculateBusinessImpact).toHaveBeenCalled();
      expect(result.businessImpactScore).toBe(85);
      expect(result.affectedUsers).toBe(1200);
    });

    it('should handle ML service unavailable gracefully', async () => {
      mlService.isMLServiceAvailable.mockResolvedValue(false);
      alertRepo.create!.mockImplementation((d: any) => ({ ...d }));
      alertRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'a1', ...d }));

      const result = await service.create({ eventId: 'evt-1' });

      expect(mlService.calculateBusinessImpact).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle ML error gracefully', async () => {
      mlService.isMLServiceAvailable.mockResolvedValue(true);
      mlService.calculateBusinessImpact.mockRejectedValue(new Error('ML down'));
      alertRepo.create!.mockImplementation((d: any) => ({ ...d }));
      alertRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'a1', ...d }));

      const result = await service.create({ eventId: 'evt-1', rootCauseAssetId: 'a1' });

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should use default pagination', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(queryBuilder.take).toHaveBeenCalledWith(50);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('should filter by status', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ status: AlertStatus.OPEN });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.status = :status',
        { status: AlertStatus.OPEN },
      );
    });

    it('should filter by owner', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ owner: 'admin' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.owner = :owner',
        { owner: 'admin' },
      );
    });

    it('should filter by slaBreached', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ slaBreached: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'alert.slaBreached = :slaBreached',
        { slaBreached: true },
      );
    });

    it('should order by slaBreached DESC then createdAt DESC', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll();

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('alert.slaBreached', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('alert.createdAt', 'DESC');
    });
  });

  describe('findOne', () => {
    it('should return alert with relations', async () => {
      const alert = createMockAlert();
      alertRepo.findOne!.mockResolvedValue(alert);

      const result = await service.findOne('alert-uuid-1');

      expect(alertRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'alert-uuid-1' },
        relations: ['event', 'rootCauseAsset'],
      });
      expect(result).toBe(alert);
    });

    it('should throw NotFoundException when not found', async () => {
      alertRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acknowledge', () => {
    it('should transition OPEN to ACKNOWLEDGED', async () => {
      const alert = createMockAlert({ status: AlertStatus.OPEN });
      alertRepo.findOne!.mockResolvedValue(alert);
      alertRepo.save!.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.acknowledge('id', 'admin');

      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(result.owner).toBe('admin');
      expect(result.acknowledgedAt).toBeDefined();
    });

    it('should throw if not OPEN', async () => {
      const alert = createMockAlert({ status: AlertStatus.ACKNOWLEDGED });
      alertRepo.findOne!.mockResolvedValue(alert);

      await expect(service.acknowledge('id', 'admin')).rejects.toThrow('OPEN');
    });
  });

  describe('resolve', () => {
    it('should set RESOLVED with notes', async () => {
      const alert = createMockAlert({ status: AlertStatus.ACKNOWLEDGED });
      alertRepo.findOne!.mockResolvedValue(alert);
      alertRepo.save!.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.resolve('id', { resolutionNotes: 'Fixed it' });

      expect(result.status).toBe(AlertStatus.RESOLVED);
      expect(result.resolutionNotes).toBe('Fixed it');
      expect(result.resolvedAt).toBeDefined();
    });

    it('should throw if CLOSED', async () => {
      const alert = createMockAlert({ status: AlertStatus.CLOSED });
      alertRepo.findOne!.mockResolvedValue(alert);

      await expect(service.resolve('id', {})).rejects.toThrow('closed');
    });
  });

  describe('close', () => {
    it('should transition RESOLVED to CLOSED', async () => {
      const alert = createMockAlert({ status: AlertStatus.RESOLVED });
      alertRepo.findOne!.mockResolvedValue(alert);
      alertRepo.save!.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.close('id');

      expect(result.status).toBe(AlertStatus.CLOSED);
      expect(result.closedAt).toBeDefined();
    });

    it('should throw if not RESOLVED', async () => {
      const alert = createMockAlert({ status: AlertStatus.OPEN });
      alertRepo.findOne!.mockResolvedValue(alert);

      await expect(service.close('id')).rejects.toThrow('RESOLVED');
    });
  });

  describe('updateBusinessImpact', () => {
    it('should update business impact fields', async () => {
      const alert = createMockAlert();
      alertRepo.findOne!.mockResolvedValue(alert);
      alertRepo.save!.mockImplementation((a: any) => Promise.resolve(a));

      const result = await service.updateBusinessImpact('id', {
        businessImpactScore: 90,
        affectedUsers: 500,
        revenueAtRisk: 25000,
      });

      expect(result.businessImpactScore).toBe(90);
      expect(result.affectedUsers).toBe(500);
      expect(result.revenueAtRisk).toBe(25000);
    });
  });
});
