// Password Policy Service
// Handles password validation, strength checking, and policy enforcement
// apps/api/src/auth/password-policy.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

interface PasswordPolicy {
  id: number;
  policy_name: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  password_history_count: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  session_timeout_minutes: number;
  is_active: boolean;
}

interface PasswordHistory {
  id: number;
  user_id: number;
  password_hash: string;
  created_at: Date;
}

interface PasswordStrength {
  score: number; // 0-4 (weak to strong)
  feedback: string[];
  isValid: boolean;
}

@Injectable()
export class PasswordPolicyService {
  constructor(
    @InjectRepository('PasswordPolicy')
    private passwordPolicyRepo: Repository<PasswordPolicy>,
    @InjectRepository('PasswordHistory')
    private passwordHistoryRepo: Repository<PasswordHistory>,
  ) {}

  /**
   * Get the active password policy
   */
  async getActivePolicy(): Promise<PasswordPolicy> {
    const policy = await this.passwordPolicyRepo.findOne({
      where: { is_active: true },
    });

    if (!policy) {
      // Return default policy if none exists
      return {
        id: 0,
        policy_name: 'default',
        min_length: 8,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_special_chars: true,
        password_history_count: 5,
        max_failed_attempts: 5,
        lockout_duration_minutes: 30,
        session_timeout_minutes: 30,
        is_active: true,
      };
    }

    return policy;
  }

  /**
   * Validate password against policy
   */
  async validatePassword(password: string): Promise<PasswordStrength> {
    const policy = await this.getActivePolicy();
    const feedback: string[] = [];
    let score = 0;

    // Check minimum length
    if (password.length < policy.min_length) {
      feedback.push(`Password must be at least ${policy.min_length} characters long`);
    } else {
      score++;
    }

    // Check uppercase requirement
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else if (policy.require_uppercase) {
      score++;
    }

    // Check lowercase requirement
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else if (policy.require_lowercase) {
      score++;
    }

    // Check numbers requirement
    if (policy.require_numbers && !/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else if (policy.require_numbers) {
      score++;
    }

    // Check special characters requirement
    if (policy.require_special_chars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Password must contain at least one special character (!@#$%^&*...)');
    } else if (policy.require_special_chars) {
      score++;
    }

    // Additional strength checks
    if (password.length >= 12) {
      score++;
      feedback.push('✓ Good length');
    }

    // Check for common patterns
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('⚠ Avoid repeating characters');
      score = Math.max(0, score - 1);
    }

    // Check for sequential characters
    if (/abc|123|qwerty/i.test(password)) {
      feedback.push('⚠ Avoid sequential patterns');
      score = Math.max(0, score - 1);
    }

    const isValid = feedback.filter(f => !f.startsWith('✓') && !f.startsWith('⚠')).length === 0;

    return {
      score: Math.min(4, score),
      feedback,
      isValid,
    };
  }

  /**
   * Check if password was used recently
   */
  async isPasswordReused(userId: number, newPassword: string): Promise<boolean> {
    const policy = await this.getActivePolicy();
    
    // Get recent password hashes
    const recentPasswords = await this.passwordHistoryRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: policy.password_history_count,
    });

    // Check if new password matches any recent password
    for (const oldPassword of recentPasswords) {
      const isMatch = await bcrypt.compare(newPassword, oldPassword.password_hash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * Save password to history
   */
  async savePasswordHistory(userId: number, passwordHash: string): Promise<void> {
    await this.passwordHistoryRepo.insert({
      user_id: userId,
      password_hash: passwordHash,
      created_at: new Date(),
    });

    // Clean up old password history beyond the limit
    const policy = await this.getActivePolicy();
    const allPasswords = await this.passwordHistoryRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    if (allPasswords.length > policy.password_history_count) {
      const toDelete = allPasswords.slice(policy.password_history_count);
      await this.passwordHistoryRepo.delete(
        toDelete.map(p => p.id)
      );
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password change request
   */
  async validatePasswordChange(
    userId: number,
    newPassword: string,
  ): Promise<{ valid: boolean; message?: string }> {
    // Check password strength
    const strength = await this.validatePassword(newPassword);
    if (!strength.isValid) {
      return {
        valid: false,
        message: strength.feedback.filter(f => !f.startsWith('✓')).join('. '),
      };
    }

    // Check password reuse
    const isReused = await this.isPasswordReused(userId, newPassword);
    if (isReused) {
      const policy = await this.getActivePolicy();
      return {
        valid: false,
        message: `Password cannot be one of your last ${policy.password_history_count} passwords`,
      };
    }

    return { valid: true };
  }

  /**
   * Get password strength label
   */
  getStrengthLabel(score: number): string {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[Math.min(score, 4)];
  }

  /**
   * Get password strength color
   */
  getStrengthColor(score: number): string {
    const colors = ['#d32f2f', '#f57c00', '#fbc02d', '#689f38', '#388e3c'];
    return colors[Math.min(score, 4)];
  }
}

export { PasswordStrength, PasswordPolicy };
