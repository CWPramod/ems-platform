import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LicenseGuard } from './license.guard';
import { LicenseValidationService } from './license-validation.service';
import { createMockLicenseValidationService } from '../test-utils/mock-services.factory';

describe('LicenseGuard', () => {
  let guard: LicenseGuard;
  let reflector: Reflector;
  let validationService: ReturnType<typeof createMockLicenseValidationService>;

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    }) as any;

  beforeEach(async () => {
    validationService = createMockLicenseValidationService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        { provide: LicenseValidationService, useValue: validationService },
      ],
    }).compile();

    guard = module.get<LicenseGuard>(LicenseGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access when no @RequiresLicense decorator', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const result = await guard.canActivate(createMockContext());
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when license is invalid', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('cloud');
    validationService.validate.mockResolvedValue({
      valid: false,
      license: null,
      status: 'expired',
      tier: null,
      message: 'Expired',
      daysRemaining: 0,
      deviceCount: 0,
      maxDevices: 0,
      deviceLimitReached: false,
      enabledFeatures: [],
      warnings: [],
    });

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when feature is not allowed', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('cloud');
    validationService.validate.mockResolvedValue({
      valid: true,
      license: {} as any,
      status: 'active',
      tier: 'nms_only',
      message: 'Active',
      daysRemaining: 30,
      deviceCount: 5,
      maxDevices: 100,
      deviceLimitReached: false,
      enabledFeatures: ['monitoring'],
      warnings: [],
    });
    validationService.isFeatureAllowed.mockResolvedValue(false);

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when license valid and feature allowed', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('monitoring');
    validationService.validate.mockResolvedValue({
      valid: true,
      license: {} as any,
      status: 'active',
      tier: 'ems_full',
      message: 'Active',
      daysRemaining: 30,
      deviceCount: 5,
      maxDevices: 100,
      deviceLimitReached: false,
      enabledFeatures: ['monitoring', 'cloud'],
      warnings: [],
    });
    validationService.isFeatureAllowed.mockResolvedValue(true);

    const result = await guard.canActivate(createMockContext());
    expect(result).toBe(true);
  });
});
