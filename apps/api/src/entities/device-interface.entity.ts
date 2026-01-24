// Device Interface Entity
// Represents network interfaces for devices
// apps/api/src/entities/device-interface.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('device_interfaces')
export class DeviceInterface {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ name: 'interface_name', type: 'varchar', length: 255 })
  interfaceName: string;

  @Column({ name: 'interface_alias', type: 'varchar', length: 255, nullable: true })
  interfaceAlias: string | null;

  @Column({ name: 'interface_index', type: 'integer', nullable: true })
  interfaceIndex: number | null;

  @Column({ name: 'interface_type', type: 'varchar', length: 50, nullable: true })
  interfaceType: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'subnet_mask', type: 'inet', nullable: true })
  subnetMask: string | null;

  @Column({ name: 'mac_address', type: 'macaddr', nullable: true })
  macAddress: string | null;

  @Column({ name: 'vlan_id', type: 'integer', nullable: true })
  vlanId: number | null;

  @Column({ name: 'speed_mbps', type: 'integer', nullable: true })
  speedMbps: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  duplex: string | null;

  @Column({ type: 'integer', default: 1500 })
  mtu: number;

  @Column({ name: 'admin_status', type: 'varchar', length: 50, default: 'up' })
  adminStatus: string;

  @Column({ name: 'operational_status', type: 'varchar', length: 50, default: 'down' })
  operationalStatus: string;

  @Column({ name: 'is_monitored', type: 'boolean', default: true })
  isMonitored: boolean;

  @Column({ name: 'monitor_bandwidth', type: 'boolean', default: true })
  monitorBandwidth: boolean;

  @Column({ name: 'monitor_errors', type: 'boolean', default: true })
  monitorErrors: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date | null;
}
