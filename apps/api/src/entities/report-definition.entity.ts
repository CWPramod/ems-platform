// Report Definition Entity
// Stores report templates and configurations
// apps/api/src/entities/report-definition.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('report_definitions')
export class ReportDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'report_name', type: 'varchar', length: 255 })
  reportName: string;

  @Column({ name: 'report_type', type: 'varchar', length: 50 })
  reportType: string; // sla, uptime, performance, traffic, alerts, custom

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'pdf' })
  format: string; // pdf, excel, csv, html

  @Column({ type: 'jsonb' })
  parameters: any; // Report parameters (date range, filters, etc.)

  @Column({ type: 'jsonb', nullable: true })
  filters: any; // Advanced filters

  @Column({ type: 'jsonb', nullable: true })
  columns: any; // Column definitions

  @Column({ type: 'jsonb', nullable: true })
  sorting: any; // Sort configuration

  @Column({ type: 'jsonb', nullable: true })
  grouping: any; // Group by configuration

  @Column({ name: 'include_charts', type: 'boolean', default: true })
  includeCharts: boolean;

  @Column({ name: 'include_summary', type: 'boolean', default: true })
  includeSummary: boolean;

  @Column({ name: 'is_template', type: 'boolean', default: false })
  isTemplate: boolean;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
