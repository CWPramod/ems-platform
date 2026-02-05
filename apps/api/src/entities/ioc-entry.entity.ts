import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IocType {
  IP_ADDRESS = 'ip_address',
  DOMAIN = 'domain',
  URL = 'url',
  FILE_HASH = 'file_hash',
  EMAIL = 'email',
}

export enum IocSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum IocStatus {
  ACTIVE = 'active',
  MATCHED = 'matched',
  EXPIRED = 'expired',
  FALSE_POSITIVE = 'false_positive',
}

@Entity('ioc_entries')
@Index(['type', 'status'])
@Index(['indicator'])
@Index(['lastMatchedAt'])
export class IocEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: IocType,
  })
  type: IocType;

  @Column({ length: 500 })
  indicator: string;

  @Column({ length: 255 })
  source: string;

  @Column({
    type: 'enum',
    enum: IocSeverity,
    default: IocSeverity.MEDIUM,
  })
  severity: IocSeverity;

  @Column({
    type: 'enum',
    enum: IocStatus,
    default: IocStatus.ACTIVE,
  })
  status: IocStatus;

  @Column({ name: 'threat_type', length: 255, nullable: true })
  threatType: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'match_count', type: 'integer', default: 0 })
  matchCount: number;

  @Column({ name: 'last_matched_at', type: 'timestamp', nullable: true })
  lastMatchedAt: Date;

  @Column({ name: 'last_matched_source_ip', length: 45, nullable: true })
  lastMatchedSourceIp: string;

  @Column({ name: 'last_matched_dest_ip', length: 45, nullable: true })
  lastMatchedDestIp: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
