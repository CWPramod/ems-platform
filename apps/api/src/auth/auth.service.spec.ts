import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { createMockRepository, MockRepository } from '../test-utils/mock-repository.factory';
import { createMockUser } from '../test-utils/mock-entities.factory';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: MockRepository;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userRepo = createMockRepository();
    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return success with valid credentials', async () => {
      const user = createMockUser();
      userRepo.findOne!.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.user).toBe(user);
    });

    it('should fail when user is not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.validateUser('unknown', 'password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should fail when account is locked', async () => {
      const user = createMockUser({
        accountLockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.validateUser('testuser', 'password');

      expect(result.success).toBe(false);
      expect(result.accountLocked).toBe(true);
    });

    it('should increment failedLoginAttempts on wrong password', async () => {
      const user = createMockUser({ failedLoginAttempts: 1 });
      userRepo.findOne!.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await service.validateUser('testuser', 'wrongpass');

      expect(userRepo.update).toHaveBeenCalledWith(user.id, expect.objectContaining({
        failedLoginAttempts: 2,
      }));
    });

    it('should lock account after 5th failed attempt', async () => {
      const user = createMockUser({ failedLoginAttempts: 4 });
      userRepo.findOne!.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('testuser', 'wrongpass');

      expect(result.accountLocked).toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith(user.id, expect.objectContaining({
        accountLockedUntil: expect.any(Date),
      }));
    });

    it('should allow login when lock has expired', async () => {
      const user = createMockUser({
        accountLockedUntil: new Date(Date.now() - 1000), // expired
        failedLoginAttempts: 5,
      });
      userRepo.findOne!.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');

      expect(result.success).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('should call jwtService.sign with correct payload', async () => {
      const user = createMockUser({ id: 42, username: 'john', email: 'john@test.com', roleId: 2 });

      await service.generateToken(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: 42,
        username: 'john',
        email: 'john@test.com',
        roleId: 2,
      });
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failedLoginAttempts to 0 and clear lock', async () => {
      await service.resetFailedAttempts(1);

      expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      }));
    });
  });

  describe('updatePassword', () => {
    it('should update password and passwordChangedAt', async () => {
      await service.updatePassword(1, 'newhash');

      expect(userRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
        password: 'newhash',
        passwordChangedAt: expect.any(Date),
      }));
    });
  });

  describe('verifyCurrentPassword', () => {
    it('should return true when password matches', async () => {
      const user = createMockUser();
      userRepo.findOne!.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyCurrentPassword(1, 'correct');
      expect(result).toBe(true);
    });

    it('should return false when user is not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.verifyCurrentPassword(999, 'any');
      expect(result).toBe(false);
    });
  });
});
