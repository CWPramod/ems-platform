import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SignatureCategory {
  MALWARE = 'malware',
  EXPLOIT = 'exploit',
  RECONNAISSANCE = 'reconnaissance',
  POLICY_VIOLATION = 'policy_violation',
  PROTOCOL_ANOMALY = 'protocol_anomaly',
  SUSPICIOUS = 'suspicious',
}

export enum SignatureSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum SignatureAction {
  ALERT = 'alert',
  DROP = 'drop',
  REJECT = 'reject',
  LOG = 'log',
}

export enum SignatureAlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated',
}

@Entity('signature_alerts')
@Index(['signatureId'])
@Index(['severity', 'timestamp'])
@Index(['sourceIp', 'destinationIp'])
@Index(['category'])
@Index(['status'])
export class SignatureAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'signature_id', length: 50 })
  signatureId: string;

  @Column({ name: 'signature_name', length: 500 })
  signatureName: string;

  @Column({
    type: 'enum',
    enum: SignatureCategory,
  })
  category: SignatureCategory;

  @Column({
    type: 'enum',
    enum: SignatureSeverity,
    default: SignatureSeverity.MEDIUM,
  })
  severity: SignatureSeverity;

  @Column({
    type: 'enum',
    enum: SignatureAction,
    default: SignatureAction.ALERT,
  })
  action: SignatureAction;

  @Column({ name: 'source_ip', length: 45 })
  sourceIp: string;

  @Column({ name: 'source_port', type: 'integer', nullable: true })
  sourcePort: number;

  @Column({ name: 'destination_ip', length: 45 })
  destinationIp: string;

  @Column({ name: 'destination_port', type: 'integer', nullable: true })
  destinationPort: number;

  @Column({ length: 20, nullable: true })
  protocol: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string;

  @Column({ name: 'packet_payload', type: 'text', nullable: true })
  packetPayload: string;

  @Column({ name: 'packet_length', type: 'integer', nullable: true })
  packetLength: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: SignatureAlertStatus,
    default: SignatureAlertStatus.OPEN,
  })
  status: SignatureAlertStatus;

  @Column({ name: 'acknowledged_by', length: 255, nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'dismissed_by', length: 255, nullable: true })
  dismissedBy: string;

  @Column({ name: 'dismissed_at', type: 'timestamp', nullable: true })
  dismissedAt: Date;

  @Column({ name: 'escalated_by', length: 255, nullable: true })
  escalatedBy: string;

  @Column({ name: 'escalated_at', type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ name: 'escalation_notes', type: 'text', nullable: true })
  escalationNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
