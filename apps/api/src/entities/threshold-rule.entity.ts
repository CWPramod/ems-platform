// Threshold Rule Entity
// Defines KPI threshold rules for monitoring
// apps/api/src/entities/threshold-rule.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('threshold_rules')
export class ThresholdRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rule_name', type: 'varchar', length: 255 })
  ruleName: string;

  @Column({ name: 'kpi_code', type: 'varchar', length: 50 })
  kpiCode: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ name: 'customer_id', type: 'integer', nullable: true })
  customerId: number | null;

  @Column({ name: 'location_id', type: 'integer', nullable: true })
  locationId: number | null;

  @Column({ name: 'device_category', type: 'varchar', length: 50, nullable: true })
  deviceCategory: string | null;

  @Column({ name: 'device_group_id', type: 'integer', nullable: true })
  deviceGroupId: number | null;

  @Column({ name: 'warning_threshold', type: 'decimal', precision: 10, scale: 2, nullable: true })
  warningThreshold: number | null;

  @Column({ name: 'critical_threshold', type: 'decimal', precision: 10, scale: 2, nullable: true })
  criticalThreshold: number | null;

  @Column({ type: 'varchar', length: 10 })
  operator: string;

  @Column({ name: 'duration_seconds', type: 'integer', default: 300 })
  durationSeconds: number;

  @Column({ name: 'consecutive_breaches', type: 'integer', default: 3 })
  consecutiveBreaches: number;

  @Column({ type: 'varchar', length: 50, default: 'warning' })
  severity: string;

  @Column({ name: 'alert_enabled', type: 'boolean', default: true })
  alertEnabled: boolean;

  @Column({ name: 'notification_enabled', type: 'boolean', default: true })
  notificationEnabled: boolean;

  @Column({ name: 'notification_channels', type: 'jsonb', nullable: true })
  notificationChannels: any;

  @Column({ name: 'notification_recipients', type: 'text', array: true, nullable: true })
  notificationRecipients: string[] | null;

  @Column({ name: 'auto_remediate', type: 'boolean', default: false })
  autoRemediate: boolean;

  @Column({ name: 'remediation_action', type: 'varchar', length: 100, nullable: true })
  remediationAction: string | null;

  @Column({ name: 'remediation_script', type: 'text', nullable: true })
  remediationScript: string | null;

  @Column({ name: 'active_hours', type: 'varchar', length: 100, nullable: true })
  activeHours: string | null;

  @Column({ name: 'active_days', type: 'varchar', length: 50, array: true, nullable: true })
  activeDays: string[] | null;

  @Column({ name: 'exclude_maintenance_windows', type: 'boolean', default: true })
  excludeMaintenanceWindows: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_triggered', type: 'timestamp', nullable: true })
  lastTriggered: Date | null;

  @Column({ name: 'trigger_count', type: 'integer', default: 0 })
  triggerCount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;
}
