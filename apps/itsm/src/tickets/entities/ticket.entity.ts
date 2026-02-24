import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SlaPolicy } from '../../sla/entities/sla-policy.entity';

@Entity('tickets')
@Index('idx_tickets_status', ['status'])
@Index('idx_tickets_sla_due_at', ['slaDueAt'], { where: '"breached" = FALSE' })
@Index('idx_tickets_alert_id', ['alertId'])
@Index('idx_tickets_asset_id', ['assetId'])
@Index('idx_tickets_assigned_to', ['assignedTo'])
@Index('idx_tickets_type', ['type'])
@Index('idx_tickets_created_at', ['createdAt'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_number', type: 'varchar', length: 20, unique: true })
  ticketNumber: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // incident, problem, change

  @Column({ type: 'varchar', length: 20 })
  severity: string; // critical, high, medium, low

  @Column({ type: 'varchar', length: 10 })
  priority: string; // P1, P2, P3, P4

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string; // open, acknowledged, in_progress, pending, resolved, closed

  @Column({ name: 'asset_id', type: 'varchar', length: 50, nullable: true })
  assetId: string;

  @Column({ name: 'alert_id', type: 'varchar', length: 50, nullable: true })
  alertId: string;

  @Column({ name: 'problem_id', type: 'uuid', nullable: true })
  problemId: string;

  @Column({ name: 'assigned_to', type: 'varchar', length: 50, nullable: true })
  assignedTo: string;

  @Column({ name: 'created_by', type: 'varchar', length: 50 })
  createdBy: string;

  @Column({ name: 'sla_policy_id', type: 'uuid', nullable: true })
  slaPolicyId: string;

  @ManyToOne(() => SlaPolicy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sla_policy_id' })
  slaPolicy: SlaPolicy;

  @Column({ name: 'sla_due_at', type: 'timestamptz', nullable: true })
  slaDueAt: Date;

  @Column({ type: 'boolean', default: false })
  breached: boolean;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source: string; // manual, auto_alert, email, api

  @Column({ name: 'pending_duration_ms', type: 'bigint', default: 0 })
  pendingDurationMs: number;

  @Column({ name: 'pending_since', type: 'timestamptz', nullable: true })
  pendingSince: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
