import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  License,
  LicenseType,
  LicenseTier,
  LicenseStatus,
} from '../entities/license.entity';
import {
  LicenseAuditLog,
  LicenseAuditAction,
} from '../entities/license-audit-log.entity';
import { LicenseKeyService } from './license-key.service';
import { LicenseValidationService } from './license-validation.service';

@Injectable()
export class LicensingService implements OnModuleInit {
  private readonly logger = new Logger(LicensingService.name);

  constructor(
    @InjectRepository(License)
    private licenseRepo: Repository<License>,
    @InjectRepository(LicenseAuditLog)
    private auditRepo: Repository<LicenseAuditLog>,
    private keyService: LicenseKeyService,
    private validationService: LicenseValidationService,
  ) {}

  /**
   * On first startup, auto-provision a 15-day trial license if none exists
   */
  async onModuleInit(): Promise<void> {
    const existingLicense = await this.licenseRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!existingLicense) {
      this.logger.log('No license found. Provisioning 15-day trial license...');
      await this.provisionTrial();
    }
  }

  /**
   * Create a 15-day trial license
   */
  async provisionTrial(): Promise<License> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const licenseKey = this.keyService.generateKey({
      type: LicenseType.TRIAL,
      tier: LicenseTier.EMS_FULL,
      maxDevices: 20,
      expiresAt,
    });

    const license = this.licenseRepo.create({
      licenseKey,
      type: LicenseType.TRIAL,
      tier: LicenseTier.EMS_FULL,
      status: LicenseStatus.ACTIVE,
      organizationName: 'Trial User',
      maxDeviceCount: 20,
      startsAt: now,
      expiresAt,
      gracePeriodDays: 7,
      activatedAt: now,
      lastValidatedAt: now,
      enabledFeatures: ['monitoring', 'alerts', 'topology', 'reports', 'metrics',
        'network', 'top-talkers', 'cloud', 'apm', 'correlations', 'ml', 'assets'],
      metadata: { autoProvisioned: true },
    });

    const saved = await this.licenseRepo.save(license);

    await this.logAudit(saved.id, LicenseAuditAction.CREATED, 'Auto-provisioned 15-day trial license', 'system');

    this.validationService.clearCache();
    this.logger.log(`Trial license provisioned: ${licenseKey}`);

    return saved;
  }

  /**
   * Activate a license key
   */
  async activate(
    licenseKey: string,
    organizationName?: string,
    performedBy?: string,
  ): Promise<License> {
    // Validate key signature
    if (!this.keyService.validateKeySignature(licenseKey)) {
      throw new BadRequestException('Invalid license key format or signature.');
    }

    // Check if key already exists
    const existing = await this.licenseRepo.findOne({ where: { licenseKey } });
    if (existing) {
      throw new BadRequestException('This license key has already been activated.');
    }

    // Decode payload
    const payload = this.keyService.decodeKeyPayload(licenseKey);
    if (!payload) {
      throw new BadRequestException('Unable to decode license key.');
    }

    // Map type/tier codes back to enums
    const typeMap: Record<string, LicenseType> = {
      TRL: LicenseType.TRIAL,
      SUB: LicenseType.SUBSCRIPTION,
      PRP: LicenseType.PERPETUAL,
    };
    const tierMap: Record<string, LicenseTier> = {
      NMS: LicenseTier.NMS_ONLY,
      EMS: LicenseTier.EMS_FULL,
    };

    const type = typeMap[payload.type] || LicenseType.SUBSCRIPTION;
    const tier = tierMap[payload.tier] || LicenseTier.NMS_ONLY;

    const now = new Date();
    const expiresAt = new Date(
      `${payload.expiresDate.substring(0, 4)}-${payload.expiresDate.substring(4, 6)}-${payload.expiresDate.substring(6, 8)}`,
    );

    // Deactivate any current active license
    await this.licenseRepo.update(
      { status: LicenseStatus.ACTIVE },
      { status: LicenseStatus.EXPIRED },
    );
    await this.licenseRepo.update(
      { status: LicenseStatus.GRACE_PERIOD },
      { status: LicenseStatus.EXPIRED },
    );

    const features = tier === LicenseTier.EMS_FULL
      ? ['monitoring', 'alerts', 'topology', 'reports', 'metrics', 'network',
         'top-talkers', 'cloud', 'apm', 'correlations', 'ml', 'assets']
      : ['monitoring', 'alerts', 'topology', 'reports', 'metrics', 'network', 'top-talkers'];

    const license = this.licenseRepo.create({
      licenseKey,
      type,
      tier,
      status: LicenseStatus.ACTIVE,
      organizationName: organizationName || 'Unknown',
      maxDeviceCount: payload.maxDevices,
      startsAt: now,
      expiresAt,
      gracePeriodDays: 7,
      activatedAt: now,
      lastValidatedAt: now,
      enabledFeatures: features,
      metadata: {},
    });

    const saved = await this.licenseRepo.save(license);

    await this.logAudit(saved.id, LicenseAuditAction.ACTIVATED,
      `License activated: ${type}/${tier}, ${payload.maxDevices} devices, expires ${expiresAt.toISOString().slice(0, 10)}`,
      performedBy || 'admin');

    this.validationService.clearCache();
    this.logger.log(`License activated: ${licenseKey}`);

    return saved;
  }

  /**
   * Get the current active license
   */
  async getActiveLicense(): Promise<License | null> {
    return this.licenseRepo.findOne({
      where: [
        { status: LicenseStatus.ACTIVE },
        { status: LicenseStatus.GRACE_PERIOD },
      ],
      order: { activatedAt: 'DESC' },
    });
  }

  /**
   * Get all licenses
   */
  async getAllLicenses(): Promise<License[]> {
    return this.licenseRepo.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Get license by ID
   */
  async getLicenseById(id: string): Promise<License> {
    const license = await this.licenseRepo.findOne({ where: { id } });
    if (!license) {
      throw new NotFoundException(`License ${id} not found.`);
    }
    return license;
  }

  /**
   * Revoke a license
   */
  async revoke(id: string, performedBy: string): Promise<License> {
    const license = await this.getLicenseById(id);

    const previousStatus = license.status;
    license.status = LicenseStatus.REVOKED;
    await this.licenseRepo.save(license);

    await this.logAudit(license.id, LicenseAuditAction.REVOKED,
      `License revoked. Previous status: ${previousStatus}`, performedBy);

    this.validationService.clearCache();
    return license;
  }

  /**
   * Generate a new license key (admin utility)
   */
  generateNewKey(params: {
    type: LicenseType;
    tier: LicenseTier;
    maxDevices: number;
    durationDays: number;
  }): string {
    const expiresAt = new Date(Date.now() + params.durationDays * 24 * 60 * 60 * 1000);
    return this.keyService.generateKey({
      type: params.type,
      tier: params.tier,
      maxDevices: params.maxDevices,
      expiresAt,
    });
  }

  /**
   * Get audit log for a license
   */
  async getAuditLog(licenseId: string): Promise<LicenseAuditLog[]> {
    return this.auditRepo.find({
      where: { licenseId },
      order: { createdAt: 'DESC' },
    });
  }

  private async logAudit(
    licenseId: string,
    action: LicenseAuditAction,
    details: string,
    performedBy: string,
  ): Promise<void> {
    try {
      const log = this.auditRepo.create({
        licenseId,
        action,
        details,
        performedBy,
      });
      await this.auditRepo.save(log);
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err}`);
    }
  }
}
