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
export enum EventSource {
  NMS = 'nms',
  CLOUD = 'cloud',
  APM = 'apm',
  SERVER = 'server',
  SIEM = 'siem',
  ITSM = 'itsm',
}

export enum EventSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

@Entity('events')
@Index(['fingerprint'])
@Index(['timestamp'])
@Index(['source', 'severity'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64 })
  fingerprint: string;

  @Column({
    type: 'enum',
    enum: EventSource,
  })
  source: EventSource;

  @Column('uuid', { nullable: true })
  assetId?: string;

  @ManyToOne(() => Asset, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assetId' })
  asset?: Asset;

  @Column({
    type: 'enum',
    enum: EventSeverity,
  })
  severity: EventSeverity;

  @Column({ length: 100 })
  category: string;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  message: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('simple-array', { nullable: true })
  affectedServices?: string[];

  @Column({ length: 64, nullable: true })
  correlationId?: string;

  @Column('uuid', { nullable: true })
  parentEventId?: string;

  @Column('timestamp')
  timestamp: Date;

  @Column('timestamp')
  firstOccurrence: Date;

  @Column('timestamp')
  lastOccurrence: Date;

  @Column('int', { default: 1 })
  occurrenceCount: number;

  @CreateDateColumn()
  createdAt: Date;
}