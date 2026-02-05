import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, LicenseStatus } from '../entities/license.entity';
import { LicenseAuditLog, LicenseAuditAction } from '../entities/license-audit-log.entity';
import { LicenseValidationService } from './license-validation.service';

@Injectable()
export class LicenseSchedulerService {
  private readonly logger = new Logger(LicenseSchedulerService.name);

  constructor(
    @InjectRepository(License)
    private licenseRepo: Repository<License>,
    @InjectRepository(LicenseAuditLog)
    private auditRepo: Repository<LicenseAuditLog>,
    private validationService: LicenseValidationService,
  ) {}

  /**
   * Check license status every hour
   * - Detect expiry → move to grace period
   * - Detect grace period end → move to expired
   * - Log warnings at 7, 3, 1 day(s) before expiry
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkLicenseStatus(): Promise<void> {
    this.logger.debug('Running license status check...');

    const activeLicenses = await this.licenseRepo.find({
      where: [
        { status: LicenseStatus.ACTIVE },
        { status: LicenseStatus.GRACE_PERIOD },
      ],
    });

    const now = new Date();

    for (const license of activeLicenses) {
      // Check grace period expiry
      if (license.status === LicenseStatus.GRACE_PERIOD) {
        const graceExpiry = license.graceExpiresAt || new Date(
          license.expiresAt.getTime() + license.gracePeriodDays * 24 * 60 * 60 * 1000,
        );

        if (now > graceExpiry) {
          await this.licenseRepo.update(license.id, { status: LicenseStatus.EXPIRED });
          await this.logAudit(license.id, LicenseAuditAction.GRACE_PERIOD_EXPIRED,
            'Grace period expired. System moved to read-only mode.');
          this.logger.warn(`License ${license.id} grace period expired.`);
          continue;
        }
      }

      // Check main expiry → start grace period
      if (license.status === LicenseStatus.ACTIVE && now > license.expiresAt) {
        const graceExpiresAt = new Date(
          license.expiresAt.getTime() + license.gracePeriodDays * 24 * 60 * 60 * 1000,
        );

        await this.licenseRepo.update(license.id, {
          status: LicenseStatus.GRACE_PERIOD,
          graceExpiresAt,
        });

        await this.logAudit(license.id, LicenseAuditAction.EXPIRED,
          `License expired. Grace period of ${license.gracePeriodDays} days started.`);
        this.logger.warn(`License ${license.id} expired. Grace period until ${graceExpiresAt.toISOString()}.`);
        continue;
      }

      // Expiry warnings
      if (license.status === LicenseStatus.ACTIVE) {
        const daysUntilExpiry = Math.ceil(
          (license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if ([7, 3, 1].includes(daysUntilExpiry)) {
          this.logger.warn(`License ${license.id} expires in ${daysUntilExpiry} day(s).`);
          await this.logAudit(license.id, LicenseAuditAction.VALIDATED,
            `Expiry warning: ${daysUntilExpiry} day(s) remaining.`);
        }
      }
    }

    // Clear validation cache so next check gets fresh data
    this.validationService.clearCache();
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
        performedBy: 'scheduler',
      });
      await this.auditRepo.save(log);
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err}`);
    }
  }
}
