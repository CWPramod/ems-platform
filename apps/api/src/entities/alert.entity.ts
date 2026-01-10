import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from './event.entity';
import { Asset } from './asset.entity';

// Enums from Phase 0 specification
export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Entity('alerts')
@Index(['status'])
@Index(['createdAt'])
@Index(['slaDeadline'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.OPEN,
  })
  status: AlertStatus;

  @Column({ length: 100, nullable: true })
  owner?: string;

  @Column({ length: 100, nullable: true })
  team?: string;

  @Column('uuid', { nullable: true })
  rootCauseAssetId?: string;

  @ManyToOne(() => Asset, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rootCauseAssetId' })
  rootCauseAsset?: Asset;

  @Column('float', { nullable: true })
  rootCauseConfidence?: number;

  @Column('int', { default: 0 })
  businessImpactScore: number;

  @Column('int', { nullable: true })
  affectedUsers?: number;

  @Column('float', { nullable: true })
  revenueAtRisk?: number;

  @Column('simple-array', { nullable: true })
  correlatedAlertIds?: string[];

  @Column('uuid', { nullable: true })
  suppressedBy?: string;

  @Column('timestamp', { nullable: true })
  slaDeadline?: Date;

  @Column({ default: false })
  slaBreached: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  acknowledgedAt?: Date;

  @Column('timestamp', { nullable: true })
  resolvedAt?: Date;

  @Column('timestamp', { nullable: true })
  closedAt?: Date;

  @Column('text', { nullable: true })
  resolutionNotes?: string;

  @Column({ length: 100, nullable: true })
  resolutionCategory?: string;

  @UpdateDateColumn()
  updatedAt: Date;
}