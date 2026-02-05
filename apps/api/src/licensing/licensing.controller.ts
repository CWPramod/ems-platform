import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicensingService } from './licensing.service';
import { LicenseValidationService } from './license-validation.service';
import { LicenseType, LicenseTier } from '../entities/license.entity';

interface ActivateLicenseDto {
  licenseKey: string;
  organizationName?: string;
}

interface GenerateKeyDto {
  type: 'trial' | 'subscription' | 'perpetual';
  tier: 'nms_only' | 'ems_full';
  maxDevices: number;
  durationDays: number;
}

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    email: string;
    roleId: number;
  };
}

@Controller('api/v1/licenses')
export class LicensingController {
  constructor(
    private licensingService: LicensingService,
    private validationService: LicenseValidationService,
  ) {}

  /**
   * GET /api/v1/licenses/status - Get current license status (public for frontend banner)
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getLicenseStatus() {
    const validation = await this.validationService.validate(true);
    return {
      success: true,
      data: {
        status: validation.status,
        tier: validation.tier,
        valid: validation.valid,
        message: validation.message,
        daysRemaining: validation.daysRemaining,
        deviceCount: validation.deviceCount,
        maxDevices: validation.maxDevices,
        deviceLimitReached: validation.deviceLimitReached,
        enabledFeatures: validation.enabledFeatures,
        warnings: validation.warnings,
        organization: validation.license?.organizationName || null,
        type: validation.license?.type || null,
        expiresAt: validation.license?.expiresAt || null,
        activatedAt: validation.license?.activatedAt || null,
      },
    };
  }

  /**
   * GET /api/v1/licenses - List all licenses (admin)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllLicenses() {
    const licenses = await this.licensingService.getAllLicenses();
    return { success: true, data: licenses };
  }

  /**
   * GET /api/v1/licenses/:id - Get license details (admin)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getLicenseById(@Param('id') id: string) {
    const license = await this.licensingService.getLicenseById(id);
    return { success: true, data: license };
  }

  /**
   * POST /api/v1/licenses/activate - Activate a new license key
   */
  @Post('activate')
  @UseGuards(JwtAuthGuard)
  async activateLicense(
    @Body() dto: ActivateLicenseDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      if (!dto.licenseKey) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'License key is required.',
        });
      }

      const license = await this.licensingService.activate(
        dto.licenseKey,
        dto.organizationName,
        req.user.username,
      );

      return res.json({
        success: true,
        message: 'License activated successfully.',
        data: license,
      });
    } catch (error: any) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: error.message || 'Failed to activate license.',
      });
    }
  }

  /**
   * POST /api/v1/licenses/generate-key - Generate a license key (admin utility)
   */
  @Post('generate-key')
  @UseGuards(JwtAuthGuard)
  async generateKey(
    @Body() dto: GenerateKeyDto,
    @Res() res: Response,
  ) {
    try {
      if (!dto.type || !dto.tier || !dto.maxDevices || !dto.durationDays) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'type, tier, maxDevices, and durationDays are required.',
        });
      }

      const typeMap: Record<string, LicenseType> = {
        trial: LicenseType.TRIAL,
        subscription: LicenseType.SUBSCRIPTION,
        perpetual: LicenseType.PERPETUAL,
      };
      const tierMap: Record<string, LicenseTier> = {
        nms_only: LicenseTier.NMS_ONLY,
        ems_full: LicenseTier.EMS_FULL,
      };

      const key = this.licensingService.generateNewKey({
        type: typeMap[dto.type] || LicenseType.SUBSCRIPTION,
        tier: tierMap[dto.tier] || LicenseTier.NMS_ONLY,
        maxDevices: dto.maxDevices,
        durationDays: dto.durationDays,
      });

      return res.json({
        success: true,
        data: { licenseKey: key },
      });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || 'Failed to generate key.',
      });
    }
  }

  /**
   * POST /api/v1/licenses/:id/revoke - Revoke a license (admin)
   */
  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeLicense(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const license = await this.licensingService.revoke(id, req.user.username);
      return res.json({
        success: true,
        message: 'License revoked.',
        data: license,
      });
    } catch (error: any) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: error.message || 'Failed to revoke license.',
      });
    }
  }

  /**
   * GET /api/v1/licenses/:id/audit-log - Get audit log for a license
   */
  @Get(':id/audit-log')
  @UseGuards(JwtAuthGuard)
  async getAuditLog(@Param('id') id: string) {
    const logs = await this.licensingService.getAuditLog(id);
    return { success: true, data: logs };
  }
}
