import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LicenseValidationService } from './license-validation.service';
import { License, LicenseStatus, LicenseTier } from '../entities/license.entity';
import { LicenseAuditLog } from '../entities/license-audit-log.entity';
import { Asset } from '../entities/asset.entity';
import { createMockRepository, MockRepository } from '../test-utils/mock-repository.factory';
import { createMockLicense } from '../test-utils/mock-entities.factory';

describe('LicenseValidationService', () => {
  let service: LicenseValidationService;
  let licenseRepo: MockRepository;
  let auditRepo: MockRepository;
  let assetRepo: MockRepository;

  beforeEach(async () => {
    licenseRepo = createMockRepository();
    auditRepo = createMockRepository();
    assetRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseValidationService,
        { provide: getRepositoryToken(License), useValue: licenseRepo },
        { provide: getRepositoryToken(LicenseAuditLog), useValue: auditRepo },
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
      ],
    }).compile();

    service = module.get<LicenseValidationService>(LicenseValidationService);
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('validate', () => {
    it('should return no_license when none found', async () => {
      licenseRepo.findOne!.mockResolvedValue(null);

      const result = await service.validate();

      expect(result.valid).toBe(false);
      expect(result.status).toBe('no_license');
    });

    it('should return ACTIVE for a valid license', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.validate();

      expect(result.valid).toBe(true);
      expect(result.status).toBe(LicenseStatus.ACTIVE);
      expect(result.daysRemaining).toBeGreaterThan(7);
    });

    it('should add warning when <=7 days remaining', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('expires'))).toBe(true);
    });

    it('should add device limit warning', async () => {
      const license = createMockLicense({
        maxDeviceCount: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(10);

      const result = await service.validate();

      expect(result.deviceLimitReached).toBe(true);
      expect(result.warnings.some((w) => w.includes('Device limit'))).toBe(true);
    });

    it('should return GRACE_PERIOD when expired within grace', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired 1 day ago
        gracePeriodDays: 7,
        status: LicenseStatus.ACTIVE,
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.validate();

      expect(result.valid).toBe(true);
      expect(result.status).toBe(LicenseStatus.GRACE_PERIOD);
    });

    it('should return EXPIRED when grace period has passed', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // expired 30 days ago
        gracePeriodDays: 7,
        graceExpiresAt: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
        status: LicenseStatus.ACTIVE,
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.validate();

      expect(result.valid).toBe(false);
      expect(result.status).toBe(LicenseStatus.EXPIRED);
    });

    it('should log audit on grace period transition', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        gracePeriodDays: 7,
        status: LicenseStatus.ACTIVE,
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      await service.validate();

      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should return cached result on second call', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      await service.validate();
      await service.validate();

      expect(licenseRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache with skipCache', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      await service.validate();
      await service.validate(true);

      expect(licenseRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should clear cache with clearCache()', async () => {
      const license = createMockLicense({
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      await service.validate();
      service.clearCache();
      await service.validate();

      expect(licenseRepo.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('isFeatureAllowed', () => {
    it('should allow NMS features for any valid license', async () => {
      const license = createMockLicense({
        tier: LicenseTier.NMS_ONLY,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.isFeatureAllowed('monitoring');
      expect(result).toBe(true);
    });

    it('should allow EMS features for EMS_FULL tier', async () => {
      const license = createMockLicense({
        tier: LicenseTier.EMS_FULL,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      const result = await service.isFeatureAllowed('cloud');
      expect(result).toBe(true);
    });

    it('should block EMS features for NMS_ONLY tier', async () => {
      const license = createMockLicense({
        tier: LicenseTier.NMS_ONLY,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(5);

      service.clearCache();
      const result = await service.isFeatureAllowed('cloud');
      expect(result).toBe(false);
    });

    it('should return false when license is invalid', async () => {
      licenseRepo.findOne!.mockResolvedValue(null);

      service.clearCache();
      const result = await service.isFeatureAllowed('monitoring');
      expect(result).toBe(false);
    });
  });

  describe('canAddDevice', () => {
    it('should return true when below device limit', async () => {
      const license = createMockLicense({
        maxDeviceCount: 100,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(50);

      const result = await service.canAddDevice();
      expect(result).toBe(true);
    });

    it('should return false when at device limit', async () => {
      const license = createMockLicense({
        maxDeviceCount: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      licenseRepo.findOne!.mockResolvedValue(license);
      assetRepo.count!.mockResolvedValue(10);

      service.clearCache();
      const result = await service.canAddDevice();
      expect(result).toBe(false);
    });
  });
});
