import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Asset } from './asset.entity';

// Enums from Phase 0 specification
export enum MetricSource {
  NMS = 'nms',
  CLOUD = 'cloud',
  APM = 'apm',
  SERVER = 'server',
}

export enum AggregationType {
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  P50 = 'p50',
  P95 = 'p95',
  P99 = 'p99',
}

@Entity('metrics')
@Index(['assetId', 'timestamp']) // Critical for time-series queries
@Index(['metricName', 'timestamp'])
export class Metric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  assetId: string;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ length: 100 })
  metricName: string;

  @Column('float')
  value: number;

  @Column({ length: 20 })
  unit: string;

  @Column({
    type: 'enum',
    enum: MetricSource,
  })
  source: MetricSource;

  @Column('jsonb', { nullable: true })
  tags?: Record<string, string>;

  @Column('timestamp')
  @Index()
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: AggregationType,
    nullable: true,
  })
  aggregationType?: AggregationType;

  @Column({ type: 'int', nullable: true })
  aggregationWindow?: number;

  @CreateDateColumn()
  createdAt: Date;
}