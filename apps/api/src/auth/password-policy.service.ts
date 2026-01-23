// Password Policy Service (Simplified)
// Handles password validation and strength checking
// apps/api/src/auth/password-policy.service.ts

import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string;
  isValid: boolean;
}

@Injectable()
export class PasswordPolicyService {
  private readonly minLength = 8;
  private readonly requireUppercase = true;
  private readonly requireLowercase = true;
  private readonly requireNumbers = true;
  private readonly requireSpecialChars = true;

  /**
   * Validate password against policy
   */
  async validatePassword(password: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): PasswordStrength {
    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;

    // Character variety
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    // Cap at 4
    score = Math.min(score, 4);

    // Generate feedback
    if (score === 0) {
      feedback.push('Very weak password');
    } else if (score === 1) {
      feedback.push('Weak password');
    } else if (score === 2) {
      feedback.push('Fair password');
    } else if (score === 3) {
      feedback.push('Good password');
    } else {
      feedback.push('Strong password');
    }

    return {
      score,
      feedback: feedback.join(', '),
      isValid: score >= 2,
    };
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
   * Check if password was used recently (simplified - no DB check for now)
   */
  async isPasswordRecentlyUsed(userId: number, password: string): Promise<boolean> {
    // TODO: Implement password history check when needed
    // For now, return false (password is not recently used)
    return false;
  }

  /**
   * Get password policy details
   */
  getPasswordPolicy() {
    return {
      minLength: this.minLength,
      requireUppercase: this.requireUppercase,
      requireLowercase: this.requireLowercase,
      requireNumbers: this.requireNumbers,
      requireSpecialChars: this.requireSpecialChars,
      passwordHistoryCount: 5,
    };
  }
}


