import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicensingService } from './licensing.service';
import { LicenseValidationService } from './license-validation.service';
import { LicenseType, LicenseTier } from '../entities/license.entity';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { GenerateKeyDto } from './dto/generate-key.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    email: string;
    roleId: number;
  };
}

@ApiTags('licensing')
@Controller('api/v1/licenses')
export class LicensingController {
  constructor(
    private licensingService: LicensingService,
    private validationService: LicenseValidationService,
  ) {}

  /**
   * GET /api/v1/licenses/status - Get current license status
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
   * GET /api/v1/licenses - List all licenses
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllLicenses() {
    const licenses = await this.licensingService.getAllLicenses();
    return { success: true, data: licenses };
  }

  /**
   * GET /api/v1/licenses/:id - Get license details
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getLicenseById(@Param('id') id: string) {
    const license = await this.licensingService.getLicenseById(id);
    return { success: true, data: license };
  }

  /**
   * POST /api/v1/licenses/activate - Activate a license key
   */
  @Post('activate')
  @UseGuards(JwtAuthGuard)
  async activateLicense(
    @Body() dto: ActivateLicenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const license = await this.licensingService.activate(
        dto.licenseKey,
        dto.organizationName,
        req.user.username,
      );

      return {
        success: true,
        message: 'License activated successfully.',
        data: license,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to activate license.');
    }
  }

  /**
   * POST /api/v1/licenses/generate-key - Generate a license key
   */
  @Post('generate-key')
  @UseGuards(JwtAuthGuard)
  async generateKey(@Body() dto: GenerateKeyDto) {
    try {
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

      return {
        success: true,
        data: { licenseKey: key },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message || 'Failed to generate key.');
    }
  }

  /**
   * POST /api/v1/licenses/:id/revoke - Revoke a license
   */
  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeLicense(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const license = await this.licensingService.revoke(id, req.user.username);
      return {
        success: true,
        message: 'License revoked.',
        data: license,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to revoke license.');
    }
  }

  /**
   * GET /api/v1/licenses/:id/audit-log - Get audit log
   */
  @Get(':id/audit-log')
  @UseGuards(JwtAuthGuard)
  async getAuditLog(@Param('id') id: string) {
    const logs = await this.licensingService.getAuditLog(id);
    return { success: true, data: logs };
  }
}
