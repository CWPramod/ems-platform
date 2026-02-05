import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum LicenseType {
  TRIAL = 'trial',
  SUBSCRIPTION = 'subscription',
  PERPETUAL = 'perpetual',
}

export enum LicenseTier {
  NMS_ONLY = 'nms_only',
  EMS_FULL = 'ems_full',
}

export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  GRACE_PERIOD = 'grace_period',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
}

@Entity('licenses')
@Index(['licenseKey'], { unique: true })
@Index(['status'])
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  licenseKey: string;

  @Column({
    type: 'enum',
    enum: LicenseType,
    default: LicenseType.TRIAL,
  })
  type: LicenseType;

  @Column({
    type: 'enum',
    enum: LicenseTier,
    default: LicenseTier.NMS_ONLY,
  })
  tier: LicenseTier;

  @Column({
    type: 'enum',
    enum: LicenseStatus,
    default: LicenseStatus.ACTIVE,
  })
  status: LicenseStatus;

  @Column({ length: 255, nullable: true })
  organizationName?: string;

  @Column('int', { default: 20 })
  maxDeviceCount: number;

  @Column('timestamp')
  startsAt: Date;

  @Column('timestamp')
  expiresAt: Date;

  @Column('int', { default: 7 })
  gracePeriodDays: number;

  @Column('timestamp', { nullable: true })
  graceExpiresAt?: Date;

  @Column({ length: 255, nullable: true })
  hardwareFingerprint?: string;

  @Column('timestamp', { nullable: true })
  activatedAt?: Date;

  @Column('timestamp', { nullable: true })
  lastValidatedAt?: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('jsonb', { default: [] })
  enabledFeatures: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
