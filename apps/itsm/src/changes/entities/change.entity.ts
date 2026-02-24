import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('changes')
export class Change {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 20, default: 'medium' })
  riskLevel: string; // low, medium, high, critical

  @Column({ name: 'approval_status', type: 'varchar', length: 30, default: 'draft' })
  approvalStatus: string; // draft, pending_approval, approved, rejected, implemented, rolled_back

  @Column({ name: 'scheduled_start', type: 'timestamptz', nullable: true })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz', nullable: true })
  scheduledEnd: Date;

  @Column({ name: 'approved_by', type: 'varchar', length: 50, nullable: true })
  approvedBy: string;

  @Column({ name: 'implementation_notes', type: 'text', nullable: true })
  implementationNotes: string;

  @Column({ name: 'rollback_plan', type: 'text', nullable: true })
  rollbackPlan: string;

  @Column({ name: 'change_number', type: 'varchar', length: 20, unique: true, nullable: true })
  changeNumber: string;

  @Column({ name: 'created_by', type: 'varchar', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
