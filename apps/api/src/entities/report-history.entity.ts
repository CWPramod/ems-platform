// Report History Entity
// Tracks generated report executions
// apps/api/src/entities/report-history.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('report_history')
export class ReportHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'report_definition_id', type: 'integer' })
  reportDefinitionId: number;

  @Column({ name: 'schedule_id', type: 'integer', nullable: true })
  scheduleId: number | null;

  @Column({ name: 'report_name', type: 'varchar', length: 255 })
  reportName: string;

  @Column({ name: 'report_type', type: 'varchar', length: 50 })
  reportType: string;

  @Column({ type: 'varchar', length: 50 })
  format: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', length: 50 })
  status: string; // pending, generating, completed, failed

  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date | null;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'row_count', type: 'integer', nullable: true })
  rowCount: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  parameters: any; // Parameters used for this run

  @Column({ name: 'generated_by', type: 'integer', nullable: true })
  generatedBy: number | null;

  @Column({ name: 'is_scheduled', type: 'boolean', default: false })
  isScheduled: boolean;

  @Column({ name: 'is_emailed', type: 'boolean', default: false })
  isEmailed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
