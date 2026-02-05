import { Test, TestingModule } from '@nestjs/testing';
import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordPolicyService],
    }).compile();

    service = module.get<PasswordPolicyService>(PasswordPolicyService);
  });

  describe('validatePassword', () => {
    it('should fail for short passwords', async () => {
      const result = await service.validatePassword('Ab1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('8 characters'))).toBe(true);
    });

    it('should fail without uppercase letter', async () => {
      const result = await service.validatePassword('abcdefg1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase'))).toBe(true);
    });

    it('should fail without lowercase letter', async () => {
      const result = await service.validatePassword('ABCDEFG1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('lowercase'))).toBe(true);
    });

    it('should fail without number', async () => {
      const result = await service.validatePassword('Abcdefgh!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('number'))).toBe(true);
    });

    it('should fail without special character', async () => {
      const result = await service.validatePassword('Abcdefg1');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('special'))).toBe(true);
    });

    it('should pass for a valid password', async () => {
      const result = await service.validatePassword('Test@12345');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return multiple errors for very weak passwords', async () => {
      const result = await service.validatePassword('abc');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should return score 0 for very weak passwords', () => {
      const strength = service.checkPasswordStrength('');
      expect(strength.score).toBe(0);
      expect(strength.isValid).toBe(false);
    });

    it('should return high score for strong passwords', () => {
      const strength = service.checkPasswordStrength('MyStr0ng!P@ssword123');
      expect(strength.score).toBe(4);
      expect(strength.isValid).toBe(true);
    });

    it('should correctly mark isValid threshold', () => {
      // score >= 2 is valid
      const weak = service.checkPasswordStrength('a');
      const fair = service.checkPasswordStrength('Abcdefgh12');
      expect(weak.isValid).toBe(false);
      expect(fair.isValid).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash', async () => {
      const hash = await service.hashPassword('Test@12345');
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
    });
  });

  describe('getPasswordPolicy', () => {
    it('should return the policy config object', () => {
      const policy = service.getPasswordPolicy();
      expect(policy.minLength).toBe(8);
      expect(policy.requireUppercase).toBe(true);
      expect(policy.requireLowercase).toBe(true);
      expect(policy.requireNumbers).toBe(true);
      expect(policy.requireSpecialChars).toBe(true);
      expect(policy.passwordHistoryCount).toBe(5);
    });
  });
});
