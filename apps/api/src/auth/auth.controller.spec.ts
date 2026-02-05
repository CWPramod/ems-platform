import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordPolicyService } from './password-policy.service';
import { SessionManagerService } from './session-manager.service';
import {
  createMockAuthService,
  createMockPasswordPolicyService,
  createMockSessionManagerService,
} from '../test-utils/mock-services.factory';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createMockAuthService>;
  let passwordService: ReturnType<typeof createMockPasswordPolicyService>;
  let sessionService: ReturnType<typeof createMockSessionManagerService>;

  const mockReq = (overrides: any = {}) => ({
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'test-agent' },
    user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin' },
    cookies: {},
    ...overrides,
  });

  const mockRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  beforeEach(async () => {
    authService = createMockAuthService();
    passwordService = createMockPasswordPolicyService();
    sessionService = createMockSessionManagerService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PasswordPolicyService, useValue: passwordService },
        { provide: SessionManagerService, useValue: sessionService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should return accessToken and sessionToken on success', async () => {
      const user = { id: 1, username: 'admin', email: 'admin@test.com', roleId: 1 };
      authService.validateUser.mockResolvedValue({ success: true, user });
      authService.generateToken.mockResolvedValue('jwt-token');
      sessionService.createSession.mockResolvedValue({
        sessionToken: 'session-123',
        expiresAt: new Date(),
      });

      const result = await controller.login(
        { username: 'admin', password: 'pass' } as any,
        mockReq() as any,
        mockRes() as any,
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('jwt-token');
      expect(result.sessionToken).toBe('session-123');
    });

    it('should throw UnauthorizedException on failure', async () => {
      authService.validateUser.mockResolvedValue({
        success: false,
        message: 'Invalid credentials',
      });

      await expect(
        controller.login(
          { username: 'bad', password: 'bad' } as any,
          mockReq() as any,
          mockRes() as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should set session cookie on success', async () => {
      const user = { id: 1, username: 'admin', email: 'admin@test.com', roleId: 1 };
      authService.validateUser.mockResolvedValue({ success: true, user });
      authService.generateToken.mockResolvedValue('jwt-token');
      sessionService.createSession.mockResolvedValue({
        sessionToken: 'session-123',
        expiresAt: new Date(),
      });

      const res = mockRes();
      await controller.login(
        { username: 'admin', password: 'pass' } as any,
        mockReq() as any,
        res as any,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'session_token',
        'session-123',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('logout', () => {
    it('should invalidate session and clear cookie', async () => {
      const res = mockRes();
      const req = mockReq({ cookies: { session_token: 'tok-1' } });

      await controller.logout(req as any, res as any);

      expect(sessionService.invalidateSession).toHaveBeenCalledWith('tok-1');
      expect(res.clearCookie).toHaveBeenCalledWith('session_token');
    });
  });

  describe('changePassword', () => {
    it('should succeed when current password correct and new valid', async () => {
      authService.verifyCurrentPassword.mockResolvedValue(true);
      passwordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      passwordService.hashPassword.mockResolvedValue('new-hash');

      const result = await controller.changePassword(
        { currentPassword: 'old', newPassword: 'New@12345' } as any,
        mockReq() as any,
      );

      expect(result.success).toBe(true);
      expect(authService.updatePassword).toHaveBeenCalled();
      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(1);
    });

    it('should fail on wrong current password', async () => {
      authService.verifyCurrentPassword.mockResolvedValue(false);

      await expect(
        controller.changePassword(
          { currentPassword: 'wrong', newPassword: 'New@12345' } as any,
          mockReq() as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail on policy violation', async () => {
      authService.verifyCurrentPassword.mockResolvedValue(true);
      passwordService.validatePassword.mockResolvedValue({
        valid: false,
        errors: ['Too short'],
      });

      await expect(
        controller.changePassword(
          { currentPassword: 'old', newPassword: 'weak' } as any,
          mockReq() as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validatePassword', () => {
    it('should return validation and strength', async () => {
      passwordService.validatePassword.mockResolvedValue({ valid: true, errors: [] });
      passwordService.checkPasswordStrength.mockReturnValue({
        score: 4, feedback: 'Strong', isValid: true,
      });

      const result = await controller.validatePassword({ password: 'Strong@123' });

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.strength.score).toBe(4);
    });
  });

  describe('healthCheck', () => {
    it('should return health object', async () => {
      const result = await controller.healthCheck();

      expect(result.success).toBe(true);
      expect(result.service).toBe('auth');
      expect(result.timestamp).toBeDefined();
    });
  });
});
