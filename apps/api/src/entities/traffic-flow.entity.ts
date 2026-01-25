// Traffic Flow Entity
// Stores network traffic flow data for top talkers analysis
// apps/api/src/entities/traffic-flow.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('traffic_flows')
@Index(['assetId', 'timestamp'])
@Index(['sourceIp', 'destinationIp', 'timestamp'])
export class TrafficFlow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ name: 'interface_id', type: 'integer', nullable: true })
  interfaceId: number | null;

  @Column({ name: 'source_ip', type: 'inet' })
  sourceIp: string;

  @Column({ name: 'destination_ip', type: 'inet' })
  destinationIp: string;

  @Column({ name: 'source_port', type: 'integer', nullable: true })
  sourcePort: number | null;

  @Column({ name: 'destination_port', type: 'integer', nullable: true })
  destinationPort: number | null;

  @Column({ type: 'varchar', length: 20 })
  protocol: string; // TCP, UDP, ICMP, etc.

  @Column({ name: 'bytes_in', type: 'bigint', default: 0 })
  bytesIn: number;

  @Column({ name: 'bytes_out', type: 'bigint', default: 0 })
  bytesOut: number;

  @Column({ name: 'packets_in', type: 'bigint', default: 0 })
  packetsIn: number;

  @Column({ name: 'packets_out', type: 'bigint', default: 0 })
  packetsOut: number;

  @Column({ name: 'flow_duration', type: 'integer', default: 0 })
  flowDuration: number; // seconds

  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ name: 'aggregation_interval', type: 'integer', default: 300 })
  aggregationInterval: number; // seconds (5 min default)

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
