// Dashboard Configuration Entity
// Stores custom dashboard layouts and widgets
// apps/api/src/entities/dashboard-config.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dashboard_configurations')
export class DashboardConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'dashboard_name', type: 'varchar', length: 255 })
  dashboardName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  layout: any; // Grid layout configuration

  @Column({ type: 'jsonb' })
  widgets: any; // Widget configurations with drill-down settings

  @Column({ name: 'refresh_interval', type: 'integer', default: 300 })
  refreshInterval: number; // Seconds

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null; // Owner of the dashboard

  @Column({ name: 'shared_with', type: 'jsonb', nullable: true })
  sharedWith: any; // User IDs or role IDs

  @Column({ type: 'jsonb', nullable: true })
  filters: any; // Global dashboard filters

  @Column({ name: 'theme', type: 'varchar', length: 50, default: 'light' })
  theme: string; // light, dark, custom

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
