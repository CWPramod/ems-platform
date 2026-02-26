// Discovery Service
// Network device auto-discovery with simulation + real SNMP scanning modes
// apps/api/src/masters/discovery/discovery.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as snmp from 'net-snmp';
import { Asset } from '../../entities/asset.entity';
import { SOPHOS_OIDS } from '../../monitoring/config/sophos-oids';

export interface ScanRequest {
  startIp: string;
  endIp: string;
  subnet?: string;
  snmpCommunity?: string;
  snmpCommunities?: string[]; // Try multiple community strings
  mode?: 'simulation' | 'real';
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
  snmpCommunity?: string; // Working community string
  sysDescr?: string;
  isSophos?: boolean;
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
   * Start a network scan (simulation or real SNMP)
   */
  async startScan(request: ScanRequest): Promise<{ scanId: string; message: string }> {
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const mode = request.mode || (process.env.SNMP_MODE === 'production' ? 'real' : 'simulation');

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

    if (mode === 'real') {
      this.runRealScan(scanId);
    } else {
      this.runSimulatedScan(scanId);
    }

    this.logger.log(`Network scan started: ${scanId} (${request.startIp} - ${request.endIp}) [${mode} mode]`);

    return {
      scanId,
      message: `Scan started for range ${request.startIp} - ${request.endIp} (${mode} mode)`,
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

    const toImport = scan.discoveredDevices.filter((d) => deviceIPs.includes(d.ip));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const device of toImport) {
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
            snmp_community: device.snmpCommunity || 'public',
            snmp_version: 'v2c',
            isSophos: device.isSophos || false,
            sysDescr: device.sysDescr,
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

  // ── Real SNMP Scanning ──────────────────────────────────────────────────

  /**
   * Real SNMP scan — probes each IP with SNMP GET for sysDescr
   */
  private async runRealScan(scanId: string): Promise<void> {
    const scan = this.scans.get(scanId);
    if (!scan) return;

    const communities = scan.request.snmpCommunities ||
      (scan.request.snmpCommunity ? [scan.request.snmpCommunity] : ['public', 'bankro']);
    const timeout = scan.request.timeout || 3000;

    const ips = this.generateIPRange(scan.request.startIp, scan.request.endIp);

    // Process IPs in batches of 10 for parallel SNMP probing
    const batchSize = 10;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((ip) => this.probeDevice(ip, communities, timeout)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const scanRef = this.scans.get(scanId);
          if (scanRef) {
            scanRef.discoveredDevices.push(result.value);
          }
        }
      }

      // Update progress
      const scanRef = this.scans.get(scanId);
      if (scanRef) {
        scanRef.scannedIPs = Math.min(i + batchSize, ips.length);
        scanRef.progress = Math.round((scanRef.scannedIPs / scanRef.totalIPs) * 100);
      }
    }

    const scanRef = this.scans.get(scanId);
    if (scanRef) {
      scanRef.status = 'completed';
      scanRef.completedAt = new Date();
      scanRef.progress = 100;
      scanRef.scannedIPs = scanRef.totalIPs;
      this.logger.log(
        `Scan ${scanId} completed: ${scanRef.discoveredDevices.length} devices found`,
      );
    }
  }

  /**
   * Probe a single IP via SNMP — try each community string
   */
  private async probeDevice(
    ip: string,
    communities: string[],
    timeout: number,
  ): Promise<DiscoveredDevice | null> {
    for (const community of communities) {
      const startTime = Date.now();
      const result = await this.snmpProbe(ip, community, timeout);

      if (result) {
        const responseTimeMs = Date.now() - startTime;
        const sysDescr = result.sysDescr || '';
        const sysName = result.sysName || '';
        const isSophos = this.detectSophos(sysDescr);

        let vendor = 'Unknown';
        let model = 'Unknown';
        let type = 'router';

        if (isSophos) {
          vendor = 'Sophos';
          model = this.parseSophosModel(sysDescr);
          type = 'firewall';
        } else {
          const parsed = this.parseVendorModel(sysDescr);
          vendor = parsed.vendor;
          model = parsed.model;
          type = parsed.type;
        }

        return {
          ip,
          hostname: sysName || `device-${ip}`,
          type,
          vendor,
          model,
          osVersion: this.parseFirmwareVersion(sysDescr),
          snmpReachable: true,
          icmpReachable: true,
          openPorts: [161],
          responseTimeMs,
          macAddress: '',
          snmpCommunity: community,
          sysDescr,
          isSophos,
        };
      }
    }

    return null;
  }

  /**
   * Send SNMP GET for system OIDs
   */
  private snmpProbe(
    ip: string,
    community: string,
    timeout: number,
  ): Promise<{ sysDescr: string; sysName: string } | null> {
    return new Promise((resolve) => {
      let responded = false;

      try {
        const session = snmp.createSession(ip, community, {
          version: snmp.Version2c,
          timeout,
          retries: 1,
        });

        const timer = setTimeout(() => {
          if (!responded) {
            responded = true;
            try { session.close(); } catch (_) { /* ignore */ }
            resolve(null);
          }
        }, timeout + 500);

        session.get(
          [SOPHOS_OIDS.system.sysDescr, SOPHOS_OIDS.system.sysName],
          (error, varbinds) => {
            if (!responded) {
              responded = true;
              clearTimeout(timer);
              try { session.close(); } catch (_) { /* ignore */ }

              if (error || !varbinds) {
                resolve(null);
              } else {
                resolve({
                  sysDescr: varbinds[0]?.value?.toString() || '',
                  sysName: varbinds[1]?.value?.toString() || '',
                });
              }
            }
          },
        );
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Detect if device is Sophos from sysDescr
   */
  private detectSophos(sysDescr: string): boolean {
    const lower = sysDescr.toLowerCase();
    return (
      lower.includes('sophos') ||
      lower.includes('sfos') ||
      lower.includes('cyberoam') ||
      lower.includes('xg firewall')
    );
  }

  private parseSophosModel(sysDescr: string): string {
    // Try to extract model like "XGS 136" or "XG 310"
    const match = sysDescr.match(/\b(XGS?\s*\d+\w?)\b/i);
    return match ? match[1].toUpperCase() : 'XG Firewall';
  }

  private parseFirmwareVersion(sysDescr: string): string {
    const match = sysDescr.match(/(?:SFOS|Version|v)\s*([\d.]+)/i);
    return match ? match[1] : '';
  }

  private parseVendorModel(sysDescr: string): { vendor: string; model: string; type: string } {
    const lower = sysDescr.toLowerCase();
    if (lower.includes('cisco')) return { vendor: 'Cisco', model: 'IOS Device', type: 'router' };
    if (lower.includes('juniper')) return { vendor: 'Juniper', model: 'Junos Device', type: 'router' };
    if (lower.includes('fortinet') || lower.includes('fortigate'))
      return { vendor: 'Fortinet', model: 'FortiGate', type: 'firewall' };
    if (lower.includes('palo alto')) return { vendor: 'Palo Alto', model: 'PAN-OS Device', type: 'firewall' };
    if (lower.includes('linux')) return { vendor: 'Linux', model: 'Linux Server', type: 'server' };

    const parts = sysDescr.split(' ');
    return {
      vendor: parts[0] || 'Unknown',
      model: parts.slice(1, 3).join(' ') || 'Unknown',
      type: 'router',
    };
  }

  private generateIPRange(startIp: string, endIp: string): string[] {
    const start = this.ipToNum(startIp);
    const end = this.ipToNum(endIp);
    const ips: string[] = [];
    for (let i = start; i <= end && ips.length < 1024; i++) {
      ips.push(this.numToIp(i));
    }
    return ips;
  }

  // ── Simulation Mode ───────────────────────────────────────────────────────

  private async runSimulatedScan(scanId: string): Promise<void> {
    const scan = this.scans.get(scanId);
    if (!scan) return;

    const totalSteps = 5;
    const delayMs = 1000;

    for (let step = 1; step <= totalSteps; step++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const scanRef = this.scans.get(scanId);
      if (!scanRef) return;

      scanRef.progress = Math.round((step / totalSteps) * 100);
      scanRef.scannedIPs = Math.round((step / totalSteps) * scanRef.totalIPs);
    }

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
    const vendors = ['Cisco', 'Juniper', 'HP', 'Dell', 'Aruba', 'Fortinet', 'Palo Alto', 'Sophos'];
    const models: Record<string, string[]> = {
      Cisco: ['ISR 4321', 'Catalyst 9300', 'ASA 5516-X', 'Nexus 9000'],
      Juniper: ['SRX 345', 'EX4300', 'MX204'],
      HP: ['ProCurve 5412', 'Aruba 2930F', 'ProLiant DL380'],
      Dell: ['PowerSwitch S5248', 'PowerEdge R740', 'N3048'],
      Aruba: ['CX 6300', 'AP-515', 'CX 8360'],
      Fortinet: ['FortiGate 100F', 'FortiSwitch 248E'],
      'Palo Alto': ['PA-3220', 'PA-850'],
      Sophos: ['XGS 136', 'XGS 2300', 'XGS 4300', 'XGS 87'],
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
        isSophos: vendor === 'Sophos',
      });
    }

    return devices;
  }

  // ── IP Utilities ──────────────────────────────────────────────────────────

  private calculateIPCount(startIp: string, endIp: string): number {
    const startNum = this.ipToNum(startIp);
    const endNum = this.ipToNum(endIp);
    return Math.abs(endNum - startNum) + 1;
  }

  private ipToNum(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  private numToIp(num: number): string {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.');
  }
}
