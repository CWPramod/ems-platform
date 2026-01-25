// Device Connection Entity
// Stores network topology connections between devices
// apps/api/src/entities/device-connection.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('device_connections')
@Index(['sourceAssetId', 'destinationAssetId'])
export class DeviceConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_asset_id', type: 'uuid' })
  sourceAssetId: string;

  @Column({ name: 'source_interface_id', type: 'integer', nullable: true })
  sourceInterfaceId: number | null;

  @Column({ name: 'destination_asset_id', type: 'uuid' })
  destinationAssetId: string;

  @Column({ name: 'destination_interface_id', type: 'integer', nullable: true })
  destinationInterfaceId: number | null;

  @Column({ name: 'connection_type', type: 'varchar', length: 50, default: 'physical' })
  connectionType: string; // physical, logical, virtual, tunnel

  @Column({ name: 'link_speed_mbps', type: 'integer', nullable: true })
  linkSpeedMbps: number | null;

  @Column({ name: 'link_status', type: 'varchar', length: 20, default: 'up' })
  linkStatus: string; // up, down, degraded

  @Column({ type: 'varchar', length: 50, nullable: true })
  protocol: string | null; // LLDP, CDP, manual, discovered

  @Column({ name: 'bandwidth_utilization', type: 'decimal', precision: 5, scale: 2, nullable: true })
  bandwidthUtilization: number | null;

  @Column({ type: 'integer', default: 0 })
  latency: number; // milliseconds

  @Column({ name: 'packet_loss', type: 'decimal', precision: 5, scale: 2, default: 0 })
  packetLoss: number; // percentage

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'discovered_at', type: 'timestamp', nullable: true })
  discoveredAt: Date | null;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Additional discovery data

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
