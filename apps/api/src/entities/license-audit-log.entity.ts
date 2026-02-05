import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { License } from './license.entity';

export enum LicenseAuditAction {
  CREATED = 'created',
  ACTIVATED = 'activated',
  VALIDATED = 'validated',
  EXPIRED = 'expired',
  GRACE_PERIOD_STARTED = 'grace_period_started',
  GRACE_PERIOD_EXPIRED = 'grace_period_expired',
  RENEWED = 'renewed',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
  DEVICE_LIMIT_REACHED = 'device_limit_reached',
  FEATURE_BLOCKED = 'feature_blocked',
}

@Entity('license_audit_logs')
@Index(['licenseId'])
@Index(['action'])
@Index(['createdAt'])
export class LicenseAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  licenseId: string;

  @ManyToOne(() => License, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'licenseId' })
  license: License;

  @Column({
    type: 'enum',
    enum: LicenseAuditAction,
  })
  action: LicenseAuditAction;

  @Column('text', { nullable: true })
  details?: string;

  @Column({ length: 100, nullable: true })
  performedBy?: string;

  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  @Column('jsonb', { default: {} })
  previousState: Record<string, any>;

  @Column('jsonb', { default: {} })
  newState: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
