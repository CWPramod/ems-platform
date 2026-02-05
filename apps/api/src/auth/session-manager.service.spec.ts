import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionManagerService } from './session-manager.service';
import { User } from '../entities/user.entity';
import { createMockRepository } from '../test-utils/mock-repository.factory';

describe('SessionManagerService', () => {
  let service: SessionManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagerService,
        { provide: getRepositoryToken(User), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get<SessionManagerService>(SessionManagerService);
  });

  describe('createSession', () => {
    it('should create a session with a unique token', async () => {
      const session = await service.createSession(1, '127.0.0.1', 'TestAgent');

      expect(session.sessionToken).toBeDefined();
      expect(session.userId).toBe(1);
      expect(session.isActive).toBe(true);
      expect(session.ipAddress).toBe('127.0.0.1');
    });

    it('should set a 30-minute expiry', async () => {
      const before = Date.now();
      const session = await service.createSession(1);
      const after = Date.now();

      const expiresMs = session.expiresAt.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 60000 - 100);
      expect(expiresMs).toBeLessThanOrEqual(after + 30 * 60000 + 100);
    });
  });

  describe('validateSession', () => {
    it('should return session for valid token', async () => {
      const session = await service.createSession(1);

      const result = await service.validateSession(session.sessionToken);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(1);
    });

    it('should return null for missing token', async () => {
      const result = await service.validateSession('nonexistent-token');
      expect(result).toBeNull();
    });

    it('should return null and delete expired session', async () => {
      const session = await service.createSession(1);
      // Force expiry by manipulating the session
      session.expiresAt = new Date(Date.now() - 1000);

      const result = await service.validateSession(session.sessionToken);
      expect(result).toBeNull();
    });
  });

  describe('updateSessionActivity', () => {
    it('should extend expiresAt', async () => {
      const session = await service.createSession(1);
      const originalExpiry = session.expiresAt.getTime();

      // Wait a tiny bit, then update
      await new Promise((r) => setTimeout(r, 10));
      await service.updateSessionActivity(session.sessionToken);

      const updated = await service.validateSession(session.sessionToken);
      expect(updated!.expiresAt.getTime()).toBeGreaterThanOrEqual(originalExpiry);
    });
  });

  describe('invalidateSession', () => {
    it('should remove session from storage', async () => {
      const session = await service.createSession(1);

      await service.invalidateSession(session.sessionToken);

      const result = await service.validateSession(session.sessionToken);
      expect(result).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('should return only sessions for given userId', async () => {
      await service.createSession(1);
      await service.createSession(1);
      await service.createSession(2);

      const sessions = await service.getUserSessions(1);
      expect(sessions).toHaveLength(2);
      sessions.forEach((s) => expect(s.userId).toBe(1));
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should remove all sessions for userId', async () => {
      await service.createSession(1);
      await service.createSession(1);
      await service.createSession(2);

      await service.invalidateAllUserSessions(1);

      const user1Sessions = await service.getUserSessions(1);
      const user2Sessions = await service.getUserSessions(2);
      expect(user1Sessions).toHaveLength(0);
      expect(user2Sessions).toHaveLength(1);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove only expired sessions', async () => {
      const active = await service.createSession(1);
      const expired = await service.createSession(2);
      expired.expiresAt = new Date(Date.now() - 1000);

      await service.cleanupExpiredSessions();

      const activeResult = await service.validateSession(active.sessionToken);
      const expiredResult = await service.validateSession(expired.sessionToken);
      expect(activeResult).not.toBeNull();
      expect(expiredResult).toBeNull();
    });
  });
});
