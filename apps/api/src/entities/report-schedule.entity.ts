// Report Schedule Entity
// Stores scheduled report configurations
// apps/api/src/entities/report-schedule.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'report_definition_id', type: 'integer' })
  reportDefinitionId: number;

  @Column({ name: 'schedule_name', type: 'varchar', length: 255 })
  scheduleName: string;

  @Column({ type: 'varchar', length: 50 })
  frequency: string; // daily, weekly, monthly, custom

  @Column({ name: 'cron_expression', type: 'varchar', length: 100, nullable: true })
  cronExpression: string | null; // For custom schedules

  @Column({ name: 'time_of_day', type: 'time', nullable: true })
  timeOfDay: string | null; // HH:MM format

  @Column({ name: 'day_of_week', type: 'integer', nullable: true })
  dayOfWeek: number | null; // 0-6 (Sunday-Saturday)

  @Column({ name: 'day_of_month', type: 'integer', nullable: true })
  dayOfMonth: number | null; // 1-31

  @Column({ type: 'jsonb' })
  recipients: any; // Email addresses

  @Column({ name: 'email_subject', type: 'varchar', length: 500, nullable: true })
  emailSubject: string | null;

  @Column({ name: 'email_body', type: 'text', nullable: true })
  emailBody: string | null;

  @Column({ name: 'attach_report', type: 'boolean', default: true })
  attachReport: boolean;

  @Column({ name: 'include_link', type: 'boolean', default: true })
  includeLink: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_run', type: 'timestamp', nullable: true })
  lastRun: Date | null;

  @Column({ name: 'next_run', type: 'timestamp', nullable: true })
  nextRun: Date | null;

  @Column({ name: 'run_count', type: 'integer', default: 0 })
  runCount: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
