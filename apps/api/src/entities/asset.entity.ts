import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Enums from Phase 0 specification
export enum AssetType {
  // Network
  ROUTER = 'router',
  SWITCH = 'switch',
  FIREWALL = 'firewall',
  LOAD_BALANCER = 'load_balancer',
  
  // Compute
  SERVER = 'server',
  VM = 'vm',
  CONTAINER = 'container',
  
  // Cloud
  EC2 = 'ec2',
  RDS = 'rds',
  LAMBDA = 'lambda',
  
  // Application
  APPLICATION = 'application',
  DATABASE = 'database',
  API = 'api',
}

export enum AssetStatus {
  ONLINE = 'online',
  WARNING = 'warning',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown',
}

export enum ServiceTier {
  CRITICAL = 1,    // Revenue-impacting, 24/7 support
  IMPORTANT = 2,   // Business operations, office hours
  STANDARD = 3,    // Non-critical, best effort
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: AssetType,
  })
  type: AssetType;

  @Column({ length: 45 })
  ip: string;

  @Column({ length: 255 })
  location: string;

  @Column({ length: 100, nullable: true })
  region?: string;

  @Column({ length: 100 })
  vendor: string;

  @Column({ length: 100, nullable: true })
  model?: string;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column({
    type: 'int',
    enum: ServiceTier,
  })
  tier: ServiceTier;

  @Column({ length: 100 })
  owner: string;

  @Column({ length: 100, nullable: true })
  department?: string;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.UNKNOWN,
  })
  status: AssetStatus;

  @Column({ default: true })
  monitoringEnabled: boolean;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}