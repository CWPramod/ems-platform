// Device Health Entity
// Tracks real-time health status and metrics for devices
// apps/api/src/entities/device-health.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('device_health')
export class DeviceHealth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id', type: 'uuid', unique: true })
  assetId: string;

  @Column({ type: 'varchar', length: 50, default: 'unknown' })
  status: string; // online, offline, warning, critical, maintenance

  @Column({ name: 'health_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  healthScore: number; // 0-100

  @Column({ name: 'is_critical', type: 'boolean', default: false })
  isCritical: boolean;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date | null;

  @Column({ name: 'response_time_ms', type: 'integer', nullable: true })
  responseTimeMs: number | null;

  // Performance Metrics
  @Column({ name: 'cpu_utilization', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cpuUtilization: number | null;

  @Column({ name: 'memory_utilization', type: 'decimal', precision: 5, scale: 2, nullable: true })
  memoryUtilization: number | null;

  @Column({ name: 'disk_utilization', type: 'decimal', precision: 5, scale: 2, nullable: true })
  diskUtilization: number | null;

  @Column({ name: 'bandwidth_in_mbps', type: 'decimal', precision: 10, scale: 2, nullable: true })
  bandwidthInMbps: number | null;

  @Column({ name: 'bandwidth_out_mbps', type: 'decimal', precision: 10, scale: 2, nullable: true })
  bandwidthOutMbps: number | null;

  @Column({ name: 'packet_loss_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  packetLossPercent: number | null;

  @Column({ name: 'latency_ms', type: 'decimal', precision: 10, scale: 2, nullable: true })
  latencyMs: number | null;

  // Interface Status
  @Column({ name: 'total_interfaces', type: 'integer', default: 0 })
  totalInterfaces: number;

  @Column({ name: 'interfaces_up', type: 'integer', default: 0 })
  interfacesUp: number;

  @Column({ name: 'interfaces_down', type: 'integer', default: 0 })
  interfacesDown: number;

  // Alerts
  @Column({ name: 'active_alerts_count', type: 'integer', default: 0 })
  activeAlertsCount: number;

  @Column({ name: 'critical_alerts_count', type: 'integer', default: 0 })
  criticalAlertsCount: number;

  @Column({ name: 'warning_alerts_count', type: 'integer', default: 0 })
  warningAlertsCount: number;

  // Availability
  @Column({ name: 'uptime_percent_24h', type: 'decimal', precision: 5, scale: 2, nullable: true })
  uptimePercent24h: number | null;

  @Column({ name: 'uptime_percent_7d', type: 'decimal', precision: 5, scale: 2, nullable: true })
  uptimePercent7d: number | null;

  @Column({ name: 'uptime_percent_30d', type: 'decimal', precision: 5, scale: 2, nullable: true })
  uptimePercent30d: number | null;

  // SLA
  @Column({ name: 'sla_compliance', type: 'boolean', default: true })
  slaCompliance: boolean;

  @Column({ name: 'sla_target_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  slaTargetPercent: number | null;

  @Column({ name: 'last_health_check', type: 'timestamp', nullable: true })
  lastHealthCheck: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
