import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sla_policies')
@Index('idx_sla_policies_default_severity', ['severity'], {
  unique: true,
  where: '"is_default" = TRUE',
})
export class SlaPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string;

  @Column({ name: 'response_time_minutes', type: 'int' })
  responseTimeMinutes: number;

  @Column({ name: 'resolution_time_minutes', type: 'int' })
  resolutionTimeMinutes: number;

  @Column({ name: 'escalation_level_1_minutes', type: 'int' })
  escalationLevel1Minutes: number;

  @Column({ name: 'escalation_level_2_minutes', type: 'int' })
  escalationLevel2Minutes: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
