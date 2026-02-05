import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseKeyService } from './license-key.service';
import { LicenseType, LicenseTier } from '../entities/license.entity';

describe('LicenseKeyService', () => {
  let service: LicenseKeyService;
  const TEST_SECRET = 'test-license-signing-secret-key';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseKeyService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(TEST_SECRET) },
        },
      ],
    }).compile();

    service = module.get<LicenseKeyService>(LicenseKeyService);
  });

  describe('generateKey', () => {
    it('should generate a key in CANARIS format', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toMatch(/^CANARIS-/);
      const parts = key.split('-');
      expect(parts.length).toBeGreaterThanOrEqual(6);
      expect(parts[0]).toBe('CANARIS');
    });

    it('should use TRL type code for trial licenses', () => {
      const key = service.generateKey({
        type: LicenseType.TRIAL,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 20,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toContain('-TRL-');
    });

    it('should use SUB type code for subscription licenses', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toContain('-SUB-');
    });

    it('should use PRP type code for perpetual licenses', () => {
      const key = service.generateKey({
        type: LicenseType.PERPETUAL,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 500,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toContain('-PRP-');
    });

    it('should use NMS tier code for NMS_ONLY licenses', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.NMS_ONLY,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toContain('-NMS-');
    });

    it('should use EMS tier code for EMS_FULL licenses', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      expect(key).toContain('-EMS-');
    });
  });

  describe('validateKeySignature', () => {
    it('should return true for a self-generated key', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      expect(service.validateKeySignature(key)).toBe(true);
    });

    it('should return false for a tampered key', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 100,
        expiresAt: new Date('2027-01-01'),
      });

      // Replace last 3 chars of the signature with different chars (same length)
      const parts = key.split('-');
      const sig = parts[parts.length - 1];
      parts[parts.length - 1] = sig.slice(0, -3) + 'xxx';
      const tampered = parts.join('-');
      expect(service.validateKeySignature(tampered)).toBe(false);
    });

    it('should return false for a malformed key', () => {
      expect(service.validateKeySignature('not-a-valid-key')).toBe(false);
    });
  });

  describe('decodeKeyPayload', () => {
    it('should decode a valid key payload', () => {
      const key = service.generateKey({
        type: LicenseType.SUBSCRIPTION,
        tier: LicenseTier.EMS_FULL,
        maxDevices: 250,
        expiresAt: new Date('2027-06-15'),
      });

      const payload = service.decodeKeyPayload(key);
      expect(payload).not.toBeNull();
      expect(payload!.type).toBe('SUB');
      expect(payload!.tier).toBe('EMS');
      expect(payload!.maxDevices).toBe(250);
      expect(payload!.expiresDate).toBe('20270615');
    });

    it('should return null for a corrupted payload', () => {
      const result = service.decodeKeyPayload('CANARIS-SUB-EMS-20270101-!!!invalid!!!-sig');
      expect(result).toBeNull();
    });
  });
});
