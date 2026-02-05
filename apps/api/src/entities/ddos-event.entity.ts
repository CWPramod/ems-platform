import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DdosAttackType {
  VOLUMETRIC = 'volumetric',
  APPLICATION = 'application',
  PROTOCOL = 'protocol',
  SCANNING = 'scanning',
}

export enum DdosSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum DdosStatus {
  ACTIVE = 'active',
  MITIGATED = 'mitigated',
  RESOLVED = 'resolved',
}

@Entity('ddos_events')
@Index(['status', 'detectedAt'])
@Index(['attackType'])
@Index(['targetIp'])
@Index(['severity'])
export class DdosEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'attack_type',
    type: 'enum',
    enum: DdosAttackType,
  })
  attackType: DdosAttackType;

  @Column({
    type: 'enum',
    enum: DdosSeverity,
    default: DdosSeverity.MEDIUM,
  })
  severity: DdosSeverity;

  @Column({
    type: 'enum',
    enum: DdosStatus,
    default: DdosStatus.ACTIVE,
  })
  status: DdosStatus;

  @Column({ name: 'target_ip', length: 45 })
  targetIp: string;

  @Column({ name: 'target_port', type: 'integer', nullable: true })
  targetPort: number;

  @Column('simple-array', { name: 'source_ips', nullable: true })
  sourceIps: string[];

  @Column({ name: 'target_asset_name', length: 255, nullable: true })
  targetAssetName: string;

  @Column({ name: 'target_asset_id', type: 'uuid', nullable: true })
  targetAssetId: string;

  @Column({ name: 'router_interface', length: 255, nullable: true })
  routerInterface: string;

  @Column({ name: 'customer_name', length: 255, nullable: true })
  customerName: string;

  @Column({ length: 50, nullable: true })
  asn: string;

  @Column({ name: 'peak_bandwidth_gbps', type: 'float', default: 0 })
  peakBandwidthGbps: number;

  @Column({ name: 'peak_pps', type: 'bigint', default: 0 })
  peakPps: number;

  @Column({ name: 'total_packets', type: 'bigint', default: 0 })
  totalPackets: number;

  @Column({ name: 'total_bytes', type: 'bigint', default: 0 })
  totalBytes: number;

  @Column({ name: 'duration_seconds', type: 'integer', default: 0 })
  durationSeconds: number;

  @Column('simple-array', { name: 'attack_vectors', nullable: true })
  attackVectors: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'mitigation_strategy', length: 255, nullable: true })
  mitigationStrategy: string;

  @Column({ name: 'mitigation_initiated_by', length: 255, nullable: true })
  mitigationInitiatedBy: string;

  @Column({ name: 'mitigation_notes', type: 'text', nullable: true })
  mitigationNotes: string;

  @Column({ name: 'resolved_by', length: 255, nullable: true })
  resolvedBy: string;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'detected_at', type: 'timestamp' })
  detectedAt: Date;

  @Column({ name: 'mitigated_at', type: 'timestamp', nullable: true })
  mitigatedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
