// Auth Service
// Handles user authentication and validation
// apps/api/src/auth/auth.service.ts

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({ 
      where: { username },
      relations: ['role'],
    });
    
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      return {
        success: false,
        message: 'Account is locked due to too many failed attempts',
        accountLocked: true,
        lockedUntil: user.accountLockedUntil,
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      // Increment failed attempts
      await this.userRepo.update(user.id, {
        failedLoginAttempts: user.failedLoginAttempts + 1,
        lastActivity: new Date(),
      });

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 4) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        await this.userRepo.update(user.id, {
          accountLockedUntil: lockUntil,
        });
        return {
          success: false,
          message: 'Account locked due to too many failed attempts',
          accountLocked: true,
          lockedUntil: lockUntil,
        };
      }
      
      return { success: false, message: 'Invalid credentials' };
    }

    return { success: true, user };
  }

  async generateToken(user: User): Promise<string> {
    const payload = { 
      userId: user.id, 
      username: user.username, 
      email: user.email,
      roleId: user.roleId,
    };
    return this.jwtService.sign(payload);
  }

  async resetFailedAttempts(userId: number): Promise<void> {
    await this.userRepo.update(userId, { 
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLogin: new Date(),
      lastActivity: new Date(),
    });
  }

  async updatePassword(userId: number, newPasswordHash: string): Promise<void> {
    await this.userRepo.update(userId, {
      password: newPasswordHash,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async verifyCurrentPassword(userId: number, password: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async logLoginAttempt(
    username: string, 
    status: string, 
    ip: string, 
    userAgent: string, 
    reason?: string
  ): Promise<void> {
    // Optional: Log to login_audit_log table
    // You can implement this later if needed
    this.logger.log(`Login attempt: ${username} - ${status} from ${ip}`);
  }

  async findUserById(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ 
      where: { id: userId },
      relations: ['role'],
    });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ 
      where: { username },
      relations: ['role'],
    });
  }
}
