// Device Metrics History Entity
// Stores time-series performance metrics for devices
// apps/api/src/entities/device-metrics-history.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('device_metrics_history')
@Index(['assetId', 'timestamp'])
@Index(['assetId', 'metricType', 'timestamp'])
export class DeviceMetricsHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ name: 'metric_type', type: 'varchar', length: 50 })
  metricType: string; // cpu, memory, disk, bandwidth_in, bandwidth_out, latency, packet_loss

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  value: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null; // percent, mbps, ms, bytes, etc.

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ name: 'aggregation_type', type: 'varchar', length: 20, default: 'instant' })
  aggregationType: string; // instant, avg, min, max, sum

  @Column({ name: 'collection_interval', type: 'integer', default: 300 })
  collectionInterval: number; // seconds (5 min default)

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional context

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
