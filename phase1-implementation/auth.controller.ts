// Enhanced Authentication Controller
// Adds password change, session management, and audit endpoints
// apps/api/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordPolicyService } from './password-policy.service';
import { SessionManagerService } from './session-manager.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface LoginDto {
  username: string;
  password: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    email: string;
    role: string;
  };
  sessionToken?: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordPolicyService: PasswordPolicyService,
    private sessionManager: SessionManagerService,
  ) {}

  /**
   * Login endpoint
   */
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Get client info
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Authenticate user
      const result = await this.authService.validateUser(
        loginDto.username,
        loginDto.password,
      );

      if (!result.success) {
        // Log failed attempt
        await this.authService.logLoginAttempt(
          loginDto.username,
          'failed',
          ipAddress,
          userAgent,
          result.message,
        );

        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: result.message,
          accountLocked: result.accountLocked,
          lockedUntil: result.lockedUntil,
        });
      }

      const user = result.user;

      // Create session
      const sessionToken = await this.sessionManager.createSession(
        user.id,
        ipAddress,
        userAgent,
      );

      // Generate JWT token
      const accessToken = await this.authService.generateToken(user);

      // Log successful login
      await this.authService.logLoginAttempt(
        loginDto.username,
        'success',
        ipAddress,
        userAgent,
      );

      // Reset failed attempts
      await this.authService.resetFailedAttempts(user.id);

      // Set session cookie
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000, // 30 minutes
      });

      return res.json({
        success: true,
        accessToken,
        sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        sessionTimeout: 30, // minutes
        forcePasswordChange: user.force_password_change || false,
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'An error occurred during login',
      });
    }
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const sessionToken = req.sessionToken || req.cookies?.session_token;

      if (sessionToken) {
        await this.sessionManager.invalidateSession(sessionToken);
      }

      // Clear session cookie
      res.clearCookie('session_token');

      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'An error occurred during logout',
      });
    }
  }

  /**
   * Change password endpoint
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const userId = req.user.userId;

      // Verify current password
      const isValidPassword = await this.authService.verifyCurrentPassword(
        userId,
        changePasswordDto.currentPassword,
      );

      if (!isValidPassword) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Validate new password
      const validation = await this.passwordPolicyService.validatePasswordChange(
        userId,
        changePasswordDto.newPassword,
      );

      if (!validation.valid) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: validation.message,
        });
      }

      // Hash new password
      const newPasswordHash = await this.passwordPolicyService.hashPassword(
        changePasswordDto.newPassword,
      );

      // Update password
      await this.authService.updatePassword(userId, newPasswordHash);

      // Save to password history
      await this.passwordPolicyService.savePasswordHistory(userId, newPasswordHash);

      // Invalidate all sessions (force re-login)
      await this.sessionManager.invalidateAllUserSessions(userId);

      return res.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      console.error('[Auth] Change password error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'An error occurred while changing password',
      });
    }
  }

  /**
   * Validate password strength endpoint (for real-time feedback)
   */
  @Post('validate-password')
  async validatePassword(@Body() body: { password: string }) {
    try {
      const strength = await this.passwordPolicyService.validatePassword(body.password);
      
      return {
        success: true,
        strength: {
          score: strength.score,
          label: this.passwordPolicyService.getStrengthLabel(strength.score),
          color: this.passwordPolicyService.getStrengthColor(strength.score),
          feedback: strength.feedback,
          isValid: strength.isValid,
        },
      };
    } catch (error) {
      console.error('[Auth] Validate password error:', error);
      throw new BadRequestException('Failed to validate password');
    }
  }

  /**
   * Refresh session endpoint
   */
  @Post('refresh-session')
  @UseGuards(JwtAuthGuard)
  async refreshSession(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const sessionToken = req.sessionToken || req.cookies?.session_token;

      if (!sessionToken) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'No session found',
        });
      }

      // Extend session
      await this.sessionManager.extendSession(sessionToken);

      return res.json({
        success: true,
        message: 'Session refreshed',
      });
    } catch (error) {
      console.error('[Auth] Refresh session error:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to refresh session',
      });
    }
  }

  /**
   * Get session status (check if expiring soon)
   */
  @Get('session-status')
  @UseGuards(JwtAuthGuard)
  async getSessionStatus(@Req() req: AuthenticatedRequest) {
    try {
      const sessionToken = req.sessionToken || req.cookies?.session_token;

      if (!sessionToken) {
        throw new UnauthorizedException('No session found');
      }

      const session = await this.sessionManager.getSessionInfo(sessionToken);
      const expiringSoon = await this.sessionManager.isSessionExpiringSoon(sessionToken);

      return {
        success: true,
        session: {
          expiresAt: session?.expires_at,
          lastActivity: session?.last_activity,
          expiringSoon,
        },
      };
    } catch (error) {
      console.error('[Auth] Session status error:', error);
      throw new UnauthorizedException('Invalid session');
    }
  }

  /**
   * Get active sessions for current user
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@Req() req: AuthenticatedRequest) {
    try {
      const userId = req.user.userId;
      const sessions = await this.sessionManager.getUserSessions(userId);

      return {
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          ipAddress: s.ip_address,
          userAgent: s.user_agent,
          lastActivity: s.last_activity,
          expiresAt: s.expires_at,
          createdAt: s.created_at,
        })),
      };
    } catch (error) {
      console.error('[Auth] Get sessions error:', error);
      throw new BadRequestException('Failed to retrieve sessions');
    }
  }

  /**
   * Get password policy
   */
  @Get('password-policy')
  async getPasswordPolicy() {
    try {
      const policy = await this.passwordPolicyService.getActivePolicy();
      
      return {
        success: true,
        policy: {
          minLength: policy.min_length,
          requireUppercase: policy.require_uppercase,
          requireLowercase: policy.require_lowercase,
          requireNumbers: policy.require_numbers,
          requireSpecialChars: policy.require_special_chars,
          sessionTimeout: policy.session_timeout_minutes,
        },
      };
    } catch (error) {
      console.error('[Auth] Get password policy error:', error);
      throw new BadRequestException('Failed to retrieve password policy');
    }
  }

  /**
   * Health check
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'auth',
    };
  }
}

export { LoginDto, ChangePasswordDto };
