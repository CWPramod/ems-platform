import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, LicenseStatus, LicenseTier } from '../entities/license.entity';
import { LicenseAuditLog, LicenseAuditAction } from '../entities/license-audit-log.entity';
import { Asset } from '../entities/asset.entity';

export interface LicenseValidationResult {
  valid: boolean;
  license: License | null;
  status: LicenseStatus | 'no_license';
  tier: LicenseTier | null;
  message: string;
  daysRemaining: number | null;
  deviceCount: number;
  maxDevices: number;
  deviceLimitReached: boolean;
  enabledFeatures: string[];
  warnings: string[];
}

@Injectable()
export class LicenseValidationService {
  private readonly logger = new Logger(LicenseValidationService.name);
  private cachedValidation: LicenseValidationResult | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @InjectRepository(License)
    private licenseRepo: Repository<License>,
    @InjectRepository(LicenseAuditLog)
    private auditRepo: Repository<LicenseAuditLog>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
  ) {}

  /**
   * Validate the current active license
   */
  async validate(skipCache = false): Promise<LicenseValidationResult> {
    if (!skipCache && this.cachedValidation && Date.now() < this.cacheExpiry) {
      return this.cachedValidation;
    }

    const result = await this.performValidation();
    this.cachedValidation = result;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    return result;
  }

  /**
   * Clear validation cache (call after license changes)
   */
  clearCache(): void {
    this.cachedValidation = null;
    this.cacheExpiry = 0;
  }

  /**
   * Check if a specific feature is allowed by the current license
   */
  async isFeatureAllowed(feature: string): Promise<boolean> {
    const validation = await this.validate();
    if (!validation.valid) return false;

    // NMS features are always available
    const nmsFeatures = ['monitoring', 'alerts', 'topology', 'reports', 'metrics', 'network'];
    if (nmsFeatures.includes(feature)) return true;

    // EMS features require EMS tier
    if (validation.tier === LicenseTier.EMS_FULL) return true;

    return false;
  }

  /**
   * Check if adding a new device would exceed the license limit
   */
  async canAddDevice(): Promise<boolean> {
    const validation = await this.validate();
    return validation.valid && !validation.deviceLimitReached;
  }

  private async performValidation(): Promise<LicenseValidationResult> {
    const warnings: string[] = [];

    // Find the active license (most recently activated, non-revoked)
    const license = await this.licenseRepo.findOne({
      where: [
        { status: LicenseStatus.ACTIVE },
        { status: LicenseStatus.GRACE_PERIOD },
      ],
      order: { activatedAt: 'DESC' },
    });

    if (!license) {
      return {
        valid: false,
        license: null,
        status: 'no_license',
        tier: null,
        message: 'No active license found. Please activate a license.',
        daysRemaining: null,
        deviceCount: 0,
        maxDevices: 0,
        deviceLimitReached: false,
        enabledFeatures: [],
        warnings: ['No license installed'],
      };
    }

    const now = new Date();
    const deviceCount = await this.assetRepo.count({ where: { monitoringEnabled: true } });
    const deviceLimitReached = deviceCount >= license.maxDeviceCount;

    // Check expiry
    if (now > license.expiresAt) {
      // Check grace period
      const graceExpiry = license.graceExpiresAt || new Date(
        license.expiresAt.getTime() + license.gracePeriodDays * 24 * 60 * 60 * 1000,
      );

      if (now > graceExpiry) {
        // Grace period expired - license is fully expired
        if (license.status !== LicenseStatus.EXPIRED) {
          await this.licenseRepo.update(license.id, { status: LicenseStatus.EXPIRED });
          await this.logAudit(license.id, LicenseAuditAction.GRACE_PERIOD_EXPIRED, 'Grace period expired');
          license.status = LicenseStatus.EXPIRED;
        }

        return {
          valid: false,
          license,
          status: LicenseStatus.EXPIRED,
          tier: license.tier,
          message: 'License has expired and grace period has ended. System is in read-only mode.',
          daysRemaining: 0,
          deviceCount,
          maxDevices: license.maxDeviceCount,
          deviceLimitReached,
          enabledFeatures: [],
          warnings: ['License expired - read-only mode'],
        };
      }

      // In grace period
      const graceDaysRemaining = Math.ceil(
        (graceExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (license.status !== LicenseStatus.GRACE_PERIOD) {
        await this.licenseRepo.update(license.id, {
          status: LicenseStatus.GRACE_PERIOD,
          graceExpiresAt: graceExpiry,
        });
        await this.logAudit(license.id, LicenseAuditAction.GRACE_PERIOD_STARTED,
          `Grace period started. ${graceDaysRemaining} days remaining.`);
        license.status = LicenseStatus.GRACE_PERIOD;
      }

      warnings.push(`License expired. Grace period: ${graceDaysRemaining} day(s) remaining.`);

      return {
        valid: true,
        license,
        status: LicenseStatus.GRACE_PERIOD,
        tier: license.tier,
        message: `License expired. Grace period ends in ${graceDaysRemaining} day(s).`,
        daysRemaining: graceDaysRemaining,
        deviceCount,
        maxDevices: license.maxDeviceCount,
        deviceLimitReached,
        enabledFeatures: this.getFeaturesForTier(license.tier),
        warnings,
      };
    }

    // License is valid
    const daysRemaining = Math.ceil(
      (license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysRemaining <= 7) {
      warnings.push(`License expires in ${daysRemaining} day(s).`);
    }

    if (deviceLimitReached) {
      warnings.push(`Device limit reached (${deviceCount}/${license.maxDeviceCount}).`);
    }

    // Update last validated timestamp
    await this.licenseRepo.update(license.id, { lastValidatedAt: now });

    return {
      valid: true,
      license,
      status: LicenseStatus.ACTIVE,
      tier: license.tier,
      message: `License active. ${daysRemaining} day(s) remaining.`,
      daysRemaining,
      deviceCount,
      maxDevices: license.maxDeviceCount,
      deviceLimitReached,
      enabledFeatures: this.getFeaturesForTier(license.tier),
      warnings,
    };
  }

  private getFeaturesForTier(tier: LicenseTier): string[] {
    const nmsFeatures = ['monitoring', 'alerts', 'topology', 'reports', 'metrics', 'network', 'top-talkers'];

    if (tier === LicenseTier.NMS_ONLY) {
      return nmsFeatures;
    }

    // EMS_FULL includes everything
    return [...nmsFeatures, 'cloud', 'apm', 'correlations', 'ml', 'assets'];
  }

  private async logAudit(
    licenseId: string,
    action: LicenseAuditAction,
    details: string,
  ): Promise<void> {
    try {
      const log = this.auditRepo.create({
        licenseId,
        action,
        details,
        performedBy: 'system',
      });
      await this.auditRepo.save(log);
    } catch (err) {
      this.logger.error(`Failed to write license audit log: ${err}`);
    }
  }
}
