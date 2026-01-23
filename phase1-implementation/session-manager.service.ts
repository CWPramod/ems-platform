// Session Management Service
// Handles user sessions, activity tracking, and auto-logout
// apps/api/src/auth/session-manager.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';

interface UserSession {
  id: number;
  user_id: number;
  session_token: string;
  ip_address: string;
  user_agent: string;
  last_activity: Date;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
}

interface User {
  id: number;
  username: string;
  email: string;
  last_activity: Date;
  failed_login_attempts: number;
  account_locked_until: Date;
}

@Injectable()
export class SessionManagerService {
  private readonly SESSION_TIMEOUT_MINUTES = 30; // Default, can be from policy

  constructor(
    @InjectRepository('UserSession')
    private sessionRepo: Repository<UserSession>,
    @InjectRepository('User')
    private userRepo: Repository<User>,
  ) {}

  /**
   * Create a new session
   */
  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    // Generate secure session token
    const sessionToken = this.generateSessionToken();

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.SESSION_TIMEOUT_MINUTES);

    // Invalidate old sessions for this user (single session per user)
    // Comment this out if you want to allow multiple concurrent sessions
    await this.sessionRepo.update(
      { user_id: userId, is_active: true },
      { is_active: false }
    );

    // Create new session
    await this.sessionRepo.insert({
      user_id: userId,
      session_token: sessionToken,
      ip_address: ipAddress,
      user_agent: userAgent,
      last_activity: new Date(),
      expires_at: expiresAt,
      is_active: true,
      created_at: new Date(),
    });

    // Update user's last activity
    await this.userRepo.update(userId, {
      last_activity: new Date(),
    });

    return sessionToken;
  }

  /**
   * Validate session and check if expired
   */
  async validateSession(sessionToken: string): Promise<UserSession | null> {
    const session = await this.sessionRepo.findOne({
      where: {
        session_token: sessionToken,
        is_active: true,
      },
    });

    if (!session) {
      return null;
    }

    // Check if session expired
    if (session.expires_at < new Date()) {
      await this.invalidateSession(sessionToken);
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    // Check for inactivity timeout
    const inactivityMinutes = this.getMinutesSince(session.last_activity);
    if (inactivityMinutes >= this.SESSION_TIMEOUT_MINUTES) {
      await this.invalidateSession(sessionToken);
      throw new UnauthorizedException('Session expired due to inactivity. Please login again.');
    }

    return session;
  }

  /**
   * Update session activity (extend session)
   */
  async updateActivity(sessionToken: string): Promise<void> {
    const session = await this.validateSession(sessionToken);
    
    if (!session) {
      return;
    }

    // Extend expiry time
    const newExpiryTime = new Date();
    newExpiryTime.setMinutes(newExpiryTime.getMinutes() + this.SESSION_TIMEOUT_MINUTES);

    await this.sessionRepo.update(
      { session_token: sessionToken },
      {
        last_activity: new Date(),
        expires_at: newExpiryTime,
      }
    );

    // Update user's last activity
    await this.userRepo.update(session.user_id, {
      last_activity: new Date(),
    });
  }

  /**
   * Invalidate a session (logout)
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    await this.sessionRepo.update(
      { session_token: sessionToken },
      { is_active: false }
    );
  }

  /**
   * Invalidate all sessions for a user (logout from all devices)
   */
  async invalidateAllUserSessions(userId: number): Promise<void> {
    await this.sessionRepo.update(
      { user_id: userId, is_active: true },
      { is_active: false }
    );
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: number): Promise<UserSession[]> {
    return this.sessionRepo.find({
      where: {
        user_id: userId,
        is_active: true,
      },
      order: {
        last_activity: 'DESC',
      },
    });
  }

  /**
   * Get session info by token
   */
  async getSessionInfo(sessionToken: string): Promise<UserSession | null> {
    return this.sessionRepo.findOne({
      where: { session_token: sessionToken },
    });
  }

  /**
   * Clean up expired sessions (runs every hour via cron)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    
    // Mark expired sessions as inactive
    const result = await this.sessionRepo.update(
      {
        expires_at: LessThan(now),
        is_active: true,
      },
      { is_active: false }
    );

    if (result.affected && result.affected > 0) {
      console.log(`[SessionManager] Cleaned up ${result.affected} expired sessions`);
    }

    // Delete very old inactive sessions (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deleteResult = await this.sessionRepo.delete({
      is_active: false,
      created_at: LessThan(sevenDaysAgo),
    });

    if (deleteResult.affected && deleteResult.affected > 0) {
      console.log(`[SessionManager] Deleted ${deleteResult.affected} old inactive sessions`);
    }
  }

  /**
   * Get session timeout warning time (in minutes before expiry)
   */
  getSessionWarningTime(): number {
    return 5; // Warn user 5 minutes before session expires
  }

  /**
   * Check if session will expire soon
   */
  async isSessionExpiringSoon(sessionToken: string): Promise<boolean> {
    const session = await this.getSessionInfo(sessionToken);
    
    if (!session) {
      return false;
    }

    const minutesUntilExpiry = this.getMinutesUntil(session.expires_at);
    return minutesUntilExpiry <= this.getSessionWarningTime();
  }

  /**
   * Extend session (refresh)
   */
  async extendSession(sessionToken: string): Promise<void> {
    await this.updateActivity(sessionToken);
  }

  // Helper methods

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getMinutesSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / 60000);
  }

  private getMinutesUntil(date: Date): number {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  }

  /**
   * Get all active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    return this.sessionRepo.count({
      where: { is_active: true },
    });
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    active: number;
    expired: number;
    total: number;
  }> {
    const active = await this.sessionRepo.count({
      where: { is_active: true },
    });

    const total = await this.sessionRepo.count();

    return {
      active,
      expired: total - active,
      total,
    };
  }
}

export { UserSession };
