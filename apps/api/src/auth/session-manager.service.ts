// Session Manager Service (Simplified)
// Handles user sessions and timeouts
// apps/api/src/auth/session-manager.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

export interface UserSession {
  id: number;
  userId: number;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly WARNING_BEFORE_TIMEOUT_MINUTES = 5;

  // In-memory session storage (simplified - no DB for now)
  private sessions: Map<string, UserSession> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /**
   * Create a new session
   */
  async createSession(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserSession> {
    const sessionToken = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT_MINUTES * 60000);

    const session: UserSession = {
      id: Date.now(), // Simple ID for in-memory storage
      userId,
      sessionToken,
      ipAddress,
      userAgent,
      lastActivity: now,
      expiresAt,
      isActive: true,
      createdAt: now,
    };

    this.sessions.set(sessionToken, session);

    return session;
  }

  /**
   * Validate session token
   */
  async validateSession(sessionToken: string): Promise<UserSession | null> {
    const session = this.sessions.get(sessionToken);

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt || !session.isActive) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    const session = this.sessions.get(sessionToken);

    if (session) {
      session.lastActivity = new Date();
      session.expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_MINUTES * 60000);
    }
  }

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    this.sessions.delete(sessionToken);
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: number): Promise<UserSession[]> {
    const userSessions: UserSession[] = [];

    this.sessions.forEach((session) => {
      if (session.userId === userId && session.isActive) {
        userSessions.push(session);
      }
    });

    return userSessions;
  }

  /**
   * Invalidate all sessions for user
   */
  async invalidateAllUserSessions(userId: number): Promise<void> {
    const tokensToDelete: string[] = [];

    this.sessions.forEach((session, token) => {
      if (session.userId === userId) {
        tokensToDelete.push(token);
      }
    });

    tokensToDelete.forEach((token) => this.sessions.delete(token));
  }

  /**
   * Get session timeout configuration
   */
  getSessionConfig() {
    return {
      timeoutMinutes: this.SESSION_TIMEOUT_MINUTES,
      warningBeforeTimeoutMinutes: this.WARNING_BEFORE_TIMEOUT_MINUTES,
    };
  }

  /**
   * Cleanup expired sessions (runs every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const tokensToDelete: string[] = [];

    this.sessions.forEach((session, token) => {
      if (now > session.expiresAt) {
        tokensToDelete.push(token);
      }
    });

    tokensToDelete.forEach((token) => this.sessions.delete(token));

    if (tokensToDelete.length > 0) {
      this.logger.log(`Cleaned up ${tokensToDelete.length} expired sessions`);
    }
  }
}


