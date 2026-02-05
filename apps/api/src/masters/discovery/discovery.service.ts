// Discovery Service
// Network device auto-discovery with simulation mode
// apps/api/src/masters/discovery/discovery.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../entities/asset.entity';

export interface ScanRequest {
  startIp: string;
  endIp: string;
  subnet?: string;
  snmpCommunity?: string;
  timeout?: number;
}

export interface DiscoveredDevice {
  ip: string;
  hostname: string;
  type: string;
  vendor: string;
  model: string;
  osVersion: string;
  snmpReachable: boolean;
  icmpReachable: boolean;
  openPorts: number[];
  responseTimeMs: number;
  macAddress: string;
}

export interface ScanResult {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  request: ScanRequest;
  progress: number;
  totalIPs: number;
  scannedIPs: number;
  discoveredDevices: DiscoveredDevice[];
  errors: string[];
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private scans = new Map<string, ScanResult>();

  constructor(
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
  ) {}

  /**
   * Start a network scan (simulation mode)
   */
  async startScan(request: ScanRequest): Promise<{ scanId: string; message: string }> {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const scanResult: ScanResult = {
      id: scanId,
      status: 'running',
      startedAt: new Date(),
      request,
      progress: 0,
      totalIPs: this.calculateIPCount(request.startIp, request.endIp),
      scannedIPs: 0,
      discoveredDevices: [],
      errors: [],
    };

    this.scans.set(scanId, scanResult);

    // Run scan asynchronously (simulation)
    this.runSimulatedScan(scanId);

    this.logger.log(`Network scan started: ${scanId} (${request.startIp} - ${request.endIp})`);

    return {
      scanId,
      message: `Scan started for range ${request.startIp} - ${request.endIp}`,
    };
  }

  /**
   * Get scan status
   */
  getScanStatus(scanId: string): ScanResult | null {
    return this.scans.get(scanId) || null;
  }

  /**
   * Get scan results
   */
  getScanResults(scanId: string): DiscoveredDevice[] | null {
    const scan = this.scans.get(scanId);
    if (!scan) return null;
    return scan.discoveredDevices;
  }

  /**
   * Import discovered devices as assets
   */
  async importDevices(
    scanId: string,
    deviceIPs: string[],
    defaults: { tier?: number; location?: string; customerId?: number },
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const scan = this.scans.get(scanId);
    if (!scan) {
      return { imported: 0, skipped: 0, errors: ['Scan not found'] };
    }

    const toImport = scan.discoveredDevices.filter(d => deviceIPs.includes(d.ip));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const device of toImport) {
      // Check if device already exists
      const existing = await this.assetRepo.findOne({ where: { ip: device.ip } });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        const asset = this.assetRepo.create({
          name: device.hostname || `device-${device.ip}`,
          type: device.type as any,
          ip: device.ip,
          vendor: device.vendor,
          model: device.model,
          status: 'online' as any,
          tier: (defaults.tier || 3) as any,
          location: defaults.location || 'Discovered',
          owner: 'auto-discovery',
          monitoringEnabled: true,
          metadata: {
            osVersion: device.osVersion,
            macAddress: device.macAddress,
            discoveredAt: new Date().toISOString(),
          },
        });

        await this.assetRepo.save(asset);
        imported++;
      } catch (error: any) {
        errors.push(`Failed to import ${device.ip}: ${error.message}`);
      }
    }

    this.logger.log(`Import complete: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped, errors };
  }

  /**
   * Simulated scan — generates realistic mock discovery results
   */
  private async runSimulatedScan(scanId: string): Promise<void> {
    const scan = this.scans.get(scanId);
    if (!scan) return;

    // Simulate gradual progress
    const totalSteps = 5;
    const delayMs = 1000;

    for (let step = 1; step <= totalSteps; step++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const scanRef = this.scans.get(scanId);
      if (!scanRef) return;

      scanRef.progress = Math.round((step / totalSteps) * 100);
      scanRef.scannedIPs = Math.round((step / totalSteps) * scanRef.totalIPs);
    }

    // Generate discovered devices
    const mockDevices = this.generateMockDiscoveries(scan.request);

    const scanRef = this.scans.get(scanId);
    if (!scanRef) return;

    scanRef.status = 'completed';
    scanRef.completedAt = new Date();
    scanRef.progress = 100;
    scanRef.scannedIPs = scanRef.totalIPs;
    scanRef.discoveredDevices = mockDevices;

    this.logger.log(`Scan ${scanId} completed: ${mockDevices.length} devices found`);
  }

  private generateMockDiscoveries(request: ScanRequest): DiscoveredDevice[] {
    const types = ['router', 'switch', 'firewall', 'server', 'access_point'];
    const vendors = ['Cisco', 'Juniper', 'HP', 'Dell', 'Aruba', 'Fortinet', 'Palo Alto'];
    const models: Record<string, string[]> = {
      Cisco: ['ISR 4321', 'Catalyst 9300', 'ASA 5516-X', 'Nexus 9000'],
      Juniper: ['SRX 345', 'EX4300', 'MX204'],
      HP: ['ProCurve 5412', 'Aruba 2930F', 'ProLiant DL380'],
      Dell: ['PowerSwitch S5248', 'PowerEdge R740', 'N3048'],
      Aruba: ['CX 6300', 'AP-515', 'CX 8360'],
      Fortinet: ['FortiGate 100F', 'FortiSwitch 248E'],
      'Palo Alto': ['PA-3220', 'PA-850'],
    };

    const startParts = request.startIp.split('.').map(Number);
    const count = Math.min(Math.floor(Math.random() * 8) + 3, 15);
    const devices: DiscoveredDevice[] = [];

    for (let i = 0; i < count; i++) {
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const vendorModels = models[vendor] || ['Unknown'];
      const type = types[Math.floor(Math.random() * types.length)];

      devices.push({
        ip: `${startParts[0]}.${startParts[1]}.${startParts[2]}.${startParts[3] + i + 1}`,
        hostname: `${type}-${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 100)}`,
        type,
        vendor,
        model: vendorModels[Math.floor(Math.random() * vendorModels.length)],
        osVersion: `${Math.floor(Math.random() * 3) + 15}.${Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 5)}`,
        snmpReachable: Math.random() > 0.2,
        icmpReachable: true,
        openPorts: [22, 80, 161, 443].filter(() => Math.random() > 0.3),
        responseTimeMs: Math.round(Math.random() * 50 + 1),
        macAddress: Array.from({ length: 6 }, () =>
          Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
        ).join(':'),
      });
    }

    return devices;
  }

  private calculateIPCount(startIp: string, endIp: string): number {
    const start = startIp.split('.').map(Number);
    const end = endIp.split('.').map(Number);

    const startNum = (start[0] << 24) + (start[1] << 16) + (start[2] << 8) + start[3];
    const endNum = (end[0] << 24) + (end[1] << 16) + (end[2] << 8) + end[3];

    return Math.abs(endNum - startNum) + 1;
  }
}
