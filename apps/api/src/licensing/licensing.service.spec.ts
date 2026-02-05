import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { LicensingService } from './licensing.service';
import { License, LicenseType, LicenseTier, LicenseStatus } from '../entities/license.entity';
import { LicenseAuditLog } from '../entities/license-audit-log.entity';
import { LicenseKeyService } from './license-key.service';
import { LicenseValidationService } from './license-validation.service';
import { createMockRepository, MockRepository } from '../test-utils/mock-repository.factory';
import { createMockLicenseKeyService, createMockLicenseValidationService } from '../test-utils/mock-services.factory';
import { createMockLicense } from '../test-utils/mock-entities.factory';

describe('LicensingService', () => {
  let service: LicensingService;
  let licenseRepo: MockRepository;
  let auditRepo: MockRepository;
  let keyService: ReturnType<typeof createMockLicenseKeyService>;
  let validationService: ReturnType<typeof createMockLicenseValidationService>;

  beforeEach(async () => {
    licenseRepo = createMockRepository();
    auditRepo = createMockRepository();
    keyService = createMockLicenseKeyService();
    validationService = createMockLicenseValidationService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensingService,
        { provide: getRepositoryToken(License), useValue: licenseRepo },
        { provide: getRepositoryToken(LicenseAuditLog), useValue: auditRepo },
        { provide: LicenseKeyService, useValue: keyService },
        { provide: LicenseValidationService, useValue: validationService },
      ],
    }).compile();

    service = module.get<LicensingService>(LicensingService);
  });

  describe('onModuleInit', () => {
    it('should auto-provision trial if no license exists', async () => {
      licenseRepo.findOne!.mockResolvedValue(null);
      licenseRepo.create!.mockImplementation((d: any) => ({ ...d }));
      licenseRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'lic-1', ...d }));

      await service.onModuleInit();

      expect(licenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LicenseType.TRIAL,
          tier: LicenseTier.EMS_FULL,
          status: LicenseStatus.ACTIVE,
          maxDeviceCount: 20,
        }),
      );
      expect(licenseRepo.save).toHaveBeenCalled();
      expect(validationService.clearCache).toHaveBeenCalled();
    });

    it('should skip provisioning if license exists', async () => {
      licenseRepo.findOne!.mockResolvedValue(createMockLicense());

      await service.onModuleInit();

      expect(licenseRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should validate key signature', async () => {
      keyService.validateKeySignature.mockReturnValue(false);

      await expect(
        service.activate('invalid-key', 'Org', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject already-used keys', async () => {
      keyService.validateKeySignature.mockReturnValue(true);
      licenseRepo.findOne!.mockResolvedValueOnce(createMockLicense()); // existing key check

      await expect(
        service.activate('used-key', 'Org', 'admin'),
      ).rejects.toThrow('already been activated');
    });

    it('should deactivate previous active licenses', async () => {
      keyService.validateKeySignature.mockReturnValue(true);
      licenseRepo.findOne!
        .mockResolvedValueOnce(null) // no existing key
        .mockResolvedValueOnce(null); // no existing for getActiveLicense if called
      keyService.decodeKeyPayload.mockReturnValue({
        type: 'SUB', tier: 'EMS', maxDevices: 100, expiresDate: '20271231',
      });
      licenseRepo.create!.mockImplementation((d: any) => ({ ...d }));
      licenseRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'new-lic', ...d }));

      await service.activate('CANARIS-SUB-EMS-20271231-payload-sig', 'Test Org', 'admin');

      // Should deactivate existing ACTIVE and GRACE_PERIOD licenses
      expect(licenseRepo.update).toHaveBeenCalledWith(
        { status: LicenseStatus.ACTIVE },
        { status: LicenseStatus.EXPIRED },
      );
      expect(licenseRepo.update).toHaveBeenCalledWith(
        { status: LicenseStatus.GRACE_PERIOD },
        { status: LicenseStatus.EXPIRED },
      );
    });

    it('should create license with correct fields from decoded payload', async () => {
      keyService.validateKeySignature.mockReturnValue(true);
      licenseRepo.findOne!.mockResolvedValue(null);
      keyService.decodeKeyPayload.mockReturnValue({
        type: 'SUB', tier: 'EMS', maxDevices: 500, expiresDate: '20271231',
      });
      licenseRepo.create!.mockImplementation((d: any) => ({ ...d }));
      licenseRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'new-lic', ...d }));

      await service.activate('valid-key', 'My Org', 'admin');

      expect(licenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LicenseType.SUBSCRIPTION,
          tier: LicenseTier.EMS_FULL,
          maxDeviceCount: 500,
          organizationName: 'My Org',
          status: LicenseStatus.ACTIVE,
        }),
      );
    });

    it('should log audit on activation', async () => {
      keyService.validateKeySignature.mockReturnValue(true);
      licenseRepo.findOne!.mockResolvedValue(null);
      keyService.decodeKeyPayload.mockReturnValue({
        type: 'SUB', tier: 'EMS', maxDevices: 100, expiresDate: '20271231',
      });
      licenseRepo.create!.mockImplementation((d: any) => ({ ...d }));
      licenseRepo.save!.mockImplementation((d: any) => Promise.resolve({ id: 'lic-1', ...d }));

      await service.activate('valid-key', 'Org', 'admin');

      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('should set status to REVOKED and log audit', async () => {
      const license = createMockLicense({ status: LicenseStatus.ACTIVE });
      licenseRepo.findOne!.mockResolvedValue(license);
      licenseRepo.save!.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.revoke(license.id, 'admin');

      expect(result.status).toBe(LicenseStatus.REVOKED);
      expect(auditRepo.save).toHaveBeenCalled();
      expect(validationService.clearCache).toHaveBeenCalled();
    });
  });

  describe('generateNewKey', () => {
    it('should delegate to keyService', () => {
      service.generateNewKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 200,
        durationDays: 365,
      });

      expect(keyService.generateKey).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LicenseType.SUBSCRIPTION,
          tier: LicenseTier.EMS_FULL,
          maxDevices: 200,
        }),
      );
    });
  });
});
