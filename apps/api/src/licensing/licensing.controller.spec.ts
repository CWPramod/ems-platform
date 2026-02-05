import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LicensingController } from './licensing.controller';
import { LicensingService } from './licensing.service';
import { LicenseValidationService } from './license-validation.service';
import { createMockLicenseValidationService } from '../test-utils/mock-services.factory';
import { createMockLicense } from '../test-utils/mock-entities.factory';

describe('LicensingController', () => {
  let controller: LicensingController;
  let licensingService: Record<string, jest.Mock>;
  let validationService: ReturnType<typeof createMockLicenseValidationService>;

  beforeEach(async () => {
    licensingService = {
      activate: jest.fn(),
      getAllLicenses: jest.fn(),
      getLicenseById: jest.fn(),
      generateNewKey: jest.fn(),
      revoke: jest.fn(),
      getAuditLog: jest.fn(),
    };
    validationService = createMockLicenseValidationService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicensingController],
      providers: [
        { provide: LicensingService, useValue: licensingService },
        { provide: LicenseValidationService, useValue: validationService },
      ],
    }).compile();

    controller = module.get<LicensingController>(LicensingController);
  });

  it('should get license status from validation service', async () => {
    const result = await controller.getLicenseStatus();

    expect(validationService.validate).toHaveBeenCalledWith(true);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should list all licenses', async () => {
    const licenses = [createMockLicense()];
    licensingService.getAllLicenses.mockResolvedValue(licenses);

    const result = await controller.getAllLicenses();

    expect(result.success).toBe(true);
    expect(result.data).toBe(licenses);
  });

  it('should activate a license successfully', async () => {
    const license = createMockLicense();
    licensingService.activate.mockResolvedValue(license);

    const req = { user: { username: 'admin' } } as any;
    const result = await controller.activateLicense(
      { licenseKey: 'CANARIS-SUB-EMS-20271231-payload-sig', organizationName: 'Org' } as any,
      req,
    );

    expect(result.success).toBe(true);
    expect(licensingService.activate).toHaveBeenCalledWith(
      'CANARIS-SUB-EMS-20271231-payload-sig',
      'Org',
      'admin',
    );
  });

  it('should throw BadRequestException on activation failure', async () => {
    licensingService.activate.mockRejectedValue(new Error('Invalid key'));

    const req = { user: { username: 'admin' } } as any;
    await expect(
      controller.activateLicense(
        { licenseKey: 'bad-key' } as any,
        req,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should generate a key', async () => {
    licensingService.generateNewKey.mockReturnValue('CANARIS-SUB-EMS-20271231-payload-sig');

    const result = await controller.generateKey({
      type: 'subscription', tier: 'ems_full', maxDevices: 100, durationDays: 365,
    } as any);

    expect(result.success).toBe(true);
    expect(result.data.licenseKey).toBeDefined();
  });

  it('should revoke a license', async () => {
    const license = createMockLicense();
    licensingService.revoke.mockResolvedValue(license);

    const req = { user: { username: 'admin' } } as any;
    const result = await controller.revokeLicense('lic-1', req);

    expect(result.success).toBe(true);
    expect(licensingService.revoke).toHaveBeenCalledWith('lic-1', 'admin');
  });
});
