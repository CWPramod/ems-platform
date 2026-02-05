import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordPolicyService } from './password-policy.service';
import { SessionManagerService } from './session-manager.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    email: string;
    role: string;
  };
  sessionToken?: string;
}

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private passwordPolicyService: PasswordPolicyService,
    private sessionManager: SessionManagerService,
  ) {}

  /**
   * Login endpoint
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await this.authService.validateUser(
        loginDto.username,
        loginDto.password,
      );

      if (!result.success) {
        await this.authService.logLoginAttempt(
          loginDto.username,
          'failed',
          ipAddress,
          userAgent,
          result.message,
        );

        throw new UnauthorizedException({
          success: false,
          message: result.message,
          accountLocked: result.accountLocked,
          lockedUntil: result.lockedUntil,
        });
      }

      const user = result.user;

      const session = await this.sessionManager.createSession(
        user.id,
        ipAddress,
        userAgent,
      );

      const accessToken = await this.authService.generateToken(user);

      await this.authService.logLoginAttempt(
        loginDto.username,
        'success',
        ipAddress,
        userAgent,
      );

      await this.authService.resetFailedAttempts(user.id);

      res.cookie('session_token', session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000,
      });

      return {
        success: true,
        accessToken,
        sessionToken: session.sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roleId: user.roleId,
        },
        sessionTimeout: 30,
        forcePasswordChange: user.forcePasswordChange || false,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error('Login error', error instanceof Error ? error.stack : undefined);
      throw new UnauthorizedException('An error occurred during login');
    }
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const sessionToken = req.sessionToken || req.cookies?.session_token;

      if (sessionToken) {
        await this.sessionManager.invalidateSession(sessionToken);
      }

      res.clearCookie('session_token');

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      this.logger.error('Logout error', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('An error occurred during logout');
    }
  }

  /**
   * Change password endpoint
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = req.user.userId;

      const isValidPassword = await this.authService.verifyCurrentPassword(
        userId,
        changePasswordDto.currentPassword,
      );

      if (!isValidPassword) {
        throw new BadRequestException('Current password is incorrect');
      }

      const validation = await this.passwordPolicyService.validatePassword(
        changePasswordDto.newPassword,
      );

      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join(', '));
      }

      const newPasswordHash = await this.passwordPolicyService.hashPassword(
        changePasswordDto.newPassword,
      );

      await this.authService.updatePassword(userId, newPasswordHash);
      await this.sessionManager.invalidateAllUserSessions(userId);

      return {
        success: true,
        message: 'Password changed successfully. Please login again.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Change password error', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('An error occurred while changing password');
    }
  }

  /**
   * Validate password strength endpoint
   */
  @Post('validate-password')
  async validatePassword(@Body() body: { password: string }) {
    try {
      const validation = await this.passwordPolicyService.validatePassword(body.password);
      const strength = this.passwordPolicyService.checkPasswordStrength(body.password);

      return {
        success: true,
        valid: validation.valid,
        errors: validation.errors,
        strength: {
          score: strength.score,
          label: strength.feedback,
          color: strength.score > 2 ? 'green' : strength.score > 1 ? 'orange' : 'red',
          isValid: strength.isValid,
        },
      };
    } catch (error) {
      this.logger.error('Validate password error', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('Failed to validate password');
    }
  }

  /**
   * Refresh session endpoint
   */
  @Post('refresh-session')
  @UseGuards(JwtAuthGuard)
  async refreshSession(@Req() req: AuthenticatedRequest) {
    const sessionToken = req.sessionToken || req.cookies?.session_token;

    if (!sessionToken) {
      throw new UnauthorizedException('No session found');
    }

    await this.sessionManager.updateSessionActivity(sessionToken);

    return {
      success: true,
      message: 'Session refreshed',
    };
  }

  /**
   * Get session status
   */
  @Get('session-status')
  @UseGuards(JwtAuthGuard)
  async getSessionStatus(@Req() req: AuthenticatedRequest) {
    const sessionToken = req.sessionToken || req.cookies?.session_token;

    if (!sessionToken) {
      throw new UnauthorizedException('No session found');
    }

    const session = await this.sessionManager.validateSession(sessionToken);

    return {
      success: true,
      session: {
        expiresAt: session?.expiresAt,
        lastActivity: session?.lastActivity,
        expiringSoon: false,
      },
    };
  }

  /**
   * Get active sessions for current user
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const sessions = await this.sessionManager.getUserSessions(userId);

    return {
      success: true,
      sessions,
    };
  }

  /**
   * Get password policy
   */
  @Get('password-policy')
  async getPasswordPolicy() {
    const policy = this.passwordPolicyService.getPasswordPolicy();

    return {
      success: true,
      policy: {
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumbers: policy.requireNumbers,
        requireSpecialChars: policy.requireSpecialChars,
        passwordHistoryCount: policy.passwordHistoryCount,
        sessionTimeout: 30,
      },
    };
  }

  /**
   * Health check
   */
  @Get('health')
  @SkipThrottle()
  async healthCheck() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      service: 'auth',
    };
  }
}
