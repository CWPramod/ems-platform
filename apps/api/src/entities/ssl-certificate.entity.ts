import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CertificateStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  EXPIRING_SOON = 'expiring_soon',
  SELF_SIGNED = 'self_signed',
  INVALID = 'invalid',
  REVOKED = 'revoked',
}

export enum TlsVersion {
  TLS_1_0 = 'TLS 1.0',
  TLS_1_1 = 'TLS 1.1',
  TLS_1_2 = 'TLS 1.2',
  TLS_1_3 = 'TLS 1.3',
  SSL_3_0 = 'SSL 3.0',
}

@Entity('ssl_certificates')
@Index(['status'])
@Index(['hostname'])
@Index(['expiresAt'])
@Index(['assetId'])
export class SslCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  hostname: string;

  @Column({ type: 'integer', default: 443 })
  port: number;

  @Column({ length: 500 })
  issuer: string;

  @Column({ length: 500 })
  subject: string;

  @Column({ name: 'serial_number', length: 255 })
  serialNumber: string;

  @Column({ length: 255 })
  fingerprint: string;

  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.VALID,
  })
  status: CertificateStatus;

  @Column({
    name: 'tls_version',
    type: 'enum',
    enum: TlsVersion,
    default: TlsVersion.TLS_1_2,
  })
  tlsVersion: TlsVersion;

  @Column({ name: 'cipher_suite', length: 255, nullable: true })
  cipherSuite: string;

  @Column({ name: 'key_length', type: 'integer', default: 2048 })
  keyLength: number;

  @Column({ name: 'is_self_signed', default: false })
  isSelfSigned: boolean;

  @Column({ name: 'is_chain_valid', default: true })
  isChainValid: boolean;

  @Column({ name: 'issued_at', type: 'timestamp' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'days_until_expiry', type: 'integer' })
  daysUntilExpiry: number;

  @Column({ name: 'security_score', type: 'integer', default: 100 })
  securityScore: number;

  @Column('simple-array', { nullable: true })
  vulnerabilities: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string;

  @Column({ name: 'last_checked', type: 'timestamp', nullable: true })
  lastChecked: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
