import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SnmpPollingService } from '../snmp/snmp-polling.service';
import { EmsCoreClient } from '../ems-core/ems-core.client';
import { NmsOrchestrationService } from '../nms/nms-orchestration.service';

export interface DiscoveredDevice {
  ip: string;
  sysName: string;
  sysDescr: string;
  sysObjectID: string;
  sysUpTime: number;
  sysLocation: string;
  sysContact: string;
  vendor: string;
  deviceType: string;
  model: string;
  interfaces: DiscoveredInterface[];
  assetId?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface DiscoveredInterface {
  interfaceName: string;
  interfaceIndex: number;
  interfaceType: number;
  speedMbps: number;
  operationalStatus: string;
  adminStatus: string;
}

export interface DiscoveryJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalIPs: number;
  scannedIPs: number;
  devicesFound: number;
  devices: DiscoveredDevice[];
  subnets: string[];
  community: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// IF-MIB OIDs for interface discovery
const IF_MIB = {
  ifDescr: '1.3.6.1.2.1.2.2.1.2',
  ifType: '1.3.6.1.2.1.2.2.1.3',
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
  ifName: '1.3.6.1.2.1.31.1.1.1.1',
};

// sysContact OID
const SYS_CONTACT_OID = '1.3.6.1.2.1.1.4.0';

// Device classification by sysObjectID prefix
const VENDOR_MAP: { prefix: string; vendor: string; defaultType: string }[] = [
  { prefix: '1.3.6.1.4.1.2604', vendor: 'Sophos', defaultType: 'firewall' },
  { prefix: '1.3.6.1.4.1.9', vendor: 'Cisco', defaultType: 'router' },
  { prefix: '1.3.6.1.4.1.2636', vendor: 'Juniper', defaultType: 'router' },
  { prefix: '1.3.6.1.4.1.12356', vendor: 'Fortinet', defaultType: 'firewall' },
  { prefix: '1.3.6.1.4.1.2011', vendor: 'Huawei', defaultType: 'switch' },
  { prefix: '1.3.6.1.4.1.11', vendor: 'HP', defaultType: 'switch' },
  { prefix: '1.3.6.1.4.1.8072', vendor: 'Net-SNMP', defaultType: 'network_device' },
];

const MAX_IPS_PER_SUBNET = 1024;
const MAX_SUBNETS = 5;
const MAX_IPS_PER_REQUEST = 200;
const BATCH_SIZE = 20;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private jobs = new Map<string, DiscoveryJob>();
  private latestJobId: string | null = null;

  constructor(
    private readonly snmpService: SnmpPollingService,
    private readonly emsCoreClient: EmsCoreClient,
    private readonly orchestrationService: NmsOrchestrationService,
  ) {}

  /**
   * Parse CIDR notation and return all host IPs (excludes network and broadcast)
   */
  parseCIDR(cidr: string): string[] {
    const match = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (!match) {
      throw new Error(`Invalid CIDR notation: ${cidr}`);
    }

    const [, ipStr, prefixStr] = match;
    const prefix = parseInt(prefixStr, 10);

    if (prefix < 16 || prefix > 30) {
      throw new Error(`CIDR prefix must be between /16 and /30, got /${prefix}`);
    }

    const parts = ipStr.split('.').map(Number);
    if (parts.some((p) => p < 0 || p > 255)) {
      throw new Error(`Invalid IP address in CIDR: ${ipStr}`);
    }

    const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const hostBits = 32 - prefix;
    const totalHosts = (1 << hostBits) - 2; // Exclude network and broadcast

    if (totalHosts <= 0) {
      return [];
    }

    const networkAddr = (ipNum >>> 0) & (~((1 << hostBits) - 1) >>> 0);
    const cappedHosts = Math.min(totalHosts, MAX_IPS_PER_SUBNET);
    const ips: string[] = [];

    for (let i = 1; i <= cappedHosts; i++) {
      const addr = (networkAddr + i) >>> 0;
      ips.push(
        `${(addr >>> 24) & 0xff}.${(addr >>> 16) & 0xff}.${(addr >>> 8) & 0xff}.${addr & 0xff}`,
      );
    }

    return ips;
  }

  /**
   * Start a discovery job for the given subnets
   */
  async startDiscovery(
    subnets: string[],
    community: string = 'public',
  ): Promise<DiscoveryJob> {
    if (subnets.length > MAX_SUBNETS) {
      throw new Error(`Maximum ${MAX_SUBNETS} subnets per request`);
    }

    // Parse all CIDRs and collect IPs
    const allIPs: string[] = [];
    for (const subnet of subnets) {
      const ips = this.parseCIDR(subnet);
      allIPs.push(...ips);
    }

    if (allIPs.length === 0) {
      throw new Error('No valid host IPs found in the provided subnets');
    }

    const jobId = uuidv4();
    const job: DiscoveryJob = {
      jobId,
      status: 'pending',
      progress: 0,
      totalIPs: allIPs.length,
      scannedIPs: 0,
      devicesFound: 0,
      devices: [],
      subnets,
      community,
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.latestJobId = jobId;

    this.logger.log(
      `Discovery job ${jobId} created: scanning ${allIPs.length} IPs across ${subnets.length} subnet(s)`,
    );

    // Run discovery asynchronously
    this.runDiscovery(job, allIPs, community).catch((err) => {
      this.logger.error(`Discovery job ${jobId} failed: ${err.message}`);
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    });

    return job;
  }

  /**
   * Start a discovery job for an explicit list of IPs (no CIDR parsing).
   * Used for targeted discovery of known static IPs (e.g., branch WAN links).
   */
  async startDiscoveryByIPs(
    ips: string[],
    community: string = 'public',
  ): Promise<DiscoveryJob> {
    if (!ips || ips.length === 0) {
      throw new Error('At least one IP address is required');
    }

    if (ips.length > MAX_IPS_PER_REQUEST) {
      throw new Error(
        `Maximum ${MAX_IPS_PER_REQUEST} IPs per request, got ${ips.length}`,
      );
    }

    // Validate each IP format (no CIDR, just plain IPs)
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    for (const ip of ips) {
      if (!ipRegex.test(ip)) {
        throw new Error(`Invalid IP address: "${ip}". Expected format: "10.0.1.1"`);
      }
      const parts = ip.split('.').map(Number);
      if (parts.some((p) => p < 0 || p > 255)) {
        throw new Error(`Invalid IP address: "${ip}". Each octet must be 0-255`);
      }
    }

    const uniqueIPs = [...new Set(ips)];

    const jobId = uuidv4();
    const job: DiscoveryJob = {
      jobId,
      status: 'pending',
      progress: 0,
      totalIPs: uniqueIPs.length,
      scannedIPs: 0,
      devicesFound: 0,
      devices: [],
      subnets: ['targeted-ips'],
      community,
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.latestJobId = jobId;

    this.logger.log(
      `Discovery job ${jobId} created: scanning ${uniqueIPs.length} targeted IP(s)`,
    );

    // Run discovery asynchronously
    this.runDiscovery(job, uniqueIPs, community).catch((err) => {
      this.logger.error(`Discovery job ${jobId} failed: ${err.message}`);
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    });

    return job;
  }

  /**
   * Get a discovery job by ID, or the latest job
   */
  getJob(jobId?: string): DiscoveryJob | null {
    if (jobId) {
      return this.jobs.get(jobId) || null;
    }
    if (this.latestJobId) {
      return this.jobs.get(this.latestJobId) || null;
    }
    return null;
  }

  /**
   * Run the actual discovery scan
   */
  private async runDiscovery(
    job: DiscoveryJob,
    ips: string[],
    community: string,
  ): Promise<void> {
    job.status = 'running';

    this.logger.log(`Starting scan of ${ips.length} IPs with community "${community}"...`);

    // Process IPs in batches
    for (let i = 0; i < ips.length; i += BATCH_SIZE) {
      const batch = ips.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((ip) => this.probeDevice(ip, community)),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        job.scannedIPs++;

        if (result.status === 'fulfilled' && result.value) {
          const device = result.value;

          // Check if asset already exists
          const existingAsset = await this.emsCoreClient.findAssetByIp(device.ip);
          if (existingAsset) {
            // If existing asset has 'pending-snmp' tag, update it with discovered data
            const tags: string[] = existingAsset.metadata?.tags || (existingAsset as any).tags || [];
            if (tags.includes('pending-snmp')) {
              this.logger.log(`Updating pending-snmp asset ${existingAsset.id} (${device.ip}) with discovered data`);
              try {
                await this.emsCoreClient.updateAsset(existingAsset.id, {
                  name: device.sysName || existingAsset.name,
                  type: device.deviceType,
                  vendor: device.vendor,
                  model: device.model,
                  status: 'active',
                  monitoringEnabled: true,
                  tags: tags.filter((t: string) => t !== 'pending-snmp').concat(['auto-discovered', device.vendor.toLowerCase()]),
                  metadata: {
                    ...existingAsset.metadata,
                    snmpCommunity: community,
                    snmpVersion: '2c',
                    snmpPort: 161,
                    sysDescr: device.sysDescr,
                    sysObjectID: device.sysObjectID,
                    sysContact: device.sysContact,
                    sysLocation: device.sysLocation,
                    discoveredAt: new Date().toISOString(),
                    snmpPending: false,
                  },
                });

                device.assetId = existingAsset.id;
                this.logger.log(`Updated asset "${existingAsset.name}" (${existingAsset.id}) — ${device.vendor} ${device.deviceType}`);

                // Create interfaces for the updated asset
                if (device.interfaces.length > 0) {
                  try {
                    await this.emsCoreClient.createDeviceInterfaces(existingAsset.id, device.interfaces);
                    this.logger.log(`Created ${device.interfaces.length} interfaces for ${existingAsset.name}`);
                  } catch (err: any) {
                    this.logger.warn(`Failed to create interfaces for ${existingAsset.name}: ${err.message}`);
                  }
                }

                // Start polling the now-discovered device
                try {
                  this.orchestrationService.startPollingDevice({ ...existingAsset, status: 'active' });
                } catch (err: any) {
                  this.logger.warn(`Failed to start polling for ${existingAsset.name}: ${err.message}`);
                }
              } catch (err: any) {
                this.logger.error(`Failed to update pending-snmp asset ${existingAsset.id}: ${err.message}`);
                device.skipped = true;
                device.skipReason = `Pending asset update failed: ${err.message}`;
              }

              job.devices.push(device);
              job.devicesFound++;
              continue;
            }

            device.skipped = true;
            device.skipReason = 'Asset already exists';
            device.assetId = existingAsset.id;
            this.logger.log(`Skipping ${device.ip} (${device.sysName}) — already exists as asset ${existingAsset.id}`);
            job.devices.push(device);
            job.devicesFound++;
            continue;
          }

          // Create asset in EMS Core
          try {
            const asset = await this.emsCoreClient.createAsset({
              name: device.sysName || `device-${device.ip}`,
              type: device.deviceType,
              ip: device.ip,
              vendor: device.vendor,
              model: device.model,
              location: device.sysLocation || undefined,
              tier: 'standard',
              owner: 'auto-discovery',
              status: 'active',
              monitoringEnabled: true,
              tags: ['auto-discovered', device.vendor.toLowerCase()],
              metadata: {
                snmpCommunity: community,
                snmpVersion: '2c',
                snmpPort: 161,
                sysDescr: device.sysDescr,
                sysObjectID: device.sysObjectID,
                sysContact: device.sysContact,
                discoveredAt: new Date().toISOString(),
              },
            });

            device.assetId = asset.id;
            this.logger.log(
              `Created asset "${asset.name}" (${asset.id}) for ${device.ip} — ${device.vendor} ${device.deviceType}`,
            );

            // Create interfaces
            if (device.interfaces.length > 0) {
              try {
                await this.emsCoreClient.createDeviceInterfaces(
                  asset.id,
                  device.interfaces,
                );
                this.logger.log(
                  `Created ${device.interfaces.length} interfaces for ${asset.name}`,
                );
              } catch (err: any) {
                this.logger.warn(
                  `Failed to create interfaces for ${asset.name}: ${err.message}`,
                );
              }
            }

            // Start polling immediately
            try {
              this.orchestrationService.startPollingDevice(asset);
            } catch (err: any) {
              this.logger.warn(
                `Failed to start polling for ${asset.name}: ${err.message}`,
              );
            }
          } catch (err: any) {
            this.logger.error(
              `Failed to create asset for ${device.ip}: ${err.message}`,
            );
            device.skipped = true;
            device.skipReason = `Asset creation failed: ${err.message}`;
          }

          job.devices.push(device);
          job.devicesFound++;
        }
      }

      job.progress = Math.round((job.scannedIPs / job.totalIPs) * 100);
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();

    this.logger.log(
      `Discovery job ${job.jobId} completed: ${job.devicesFound} devices found out of ${job.totalIPs} IPs scanned`,
    );
  }

  /**
   * Probe a single IP via SNMP — returns discovered device or null if unreachable
   */
  private async probeDevice(
    ip: string,
    community: string,
  ): Promise<DiscoveredDevice | null> {
    try {
      // Get basic system info
      const deviceInfo = await this.snmpService.pollDevice(ip, community, '2c', 161);

      if (!deviceInfo.sysDescr && !deviceInfo.sysName) {
        return null;
      }

      // Get sysContact
      let sysContact = '';
      try {
        const contactResult = await this.snmpGet(ip, community, [SYS_CONTACT_OID]);
        if (contactResult && contactResult[0]?.value) {
          sysContact = contactResult[0].value.toString();
        }
      } catch (_) {
        // sysContact is optional
      }

      // Classify device
      const { vendor, deviceType, model } = this.classifyDevice(
        deviceInfo.sysObjectID,
        deviceInfo.sysDescr,
        deviceInfo.manufacturer,
        deviceInfo.model,
      );

      // Discover interfaces via IF-MIB walk
      const interfaces = await this.discoverInterfaces(ip, community);

      return {
        ip,
        sysName: deviceInfo.sysName,
        sysDescr: deviceInfo.sysDescr,
        sysObjectID: deviceInfo.sysObjectID,
        sysUpTime: deviceInfo.sysUpTime,
        sysLocation: deviceInfo.sysLocation,
        sysContact,
        vendor,
        deviceType,
        model,
        interfaces,
      };
    } catch (_) {
      // Device not reachable — this is expected for most IPs in a subnet
      return null;
    }
  }

  /**
   * Classify a device by sysObjectID prefix and sysDescr keywords
   */
  private classifyDevice(
    sysObjectID: string,
    sysDescr: string,
    existingManufacturer?: string,
    existingModel?: string,
  ): { vendor: string; deviceType: string; model: string } {
    // Try sysObjectID prefix match first
    for (const entry of VENDOR_MAP) {
      if (sysObjectID.startsWith(entry.prefix)) {
        return {
          vendor: entry.vendor,
          deviceType: entry.defaultType,
          model: existingModel || this.extractModel(sysDescr, entry.vendor),
        };
      }
    }

    // Fallback: keyword matching in sysDescr
    const descrLower = sysDescr.toLowerCase();
    let deviceType = 'network_device';

    if (descrLower.includes('firewall') || descrLower.includes('sfos') || descrLower.includes('fortigate')) {
      deviceType = 'firewall';
    } else if (descrLower.includes('switch') || descrLower.includes('catalyst')) {
      deviceType = 'switch';
    } else if (descrLower.includes('router') || descrLower.includes('isr')) {
      deviceType = 'router';
    } else if (descrLower.includes('access point') || descrLower.includes(' ap ') || descrLower.includes('wireless')) {
      deviceType = 'access_point';
    }

    return {
      vendor: existingManufacturer || this.extractVendor(sysDescr),
      deviceType,
      model: existingModel || sysDescr.split(' ').slice(0, 3).join(' '),
    };
  }

  /**
   * Extract vendor name from sysDescr
   */
  private extractVendor(sysDescr: string): string {
    const firstWord = sysDescr.split(' ')[0];
    return firstWord || 'Unknown';
  }

  /**
   * Extract model from sysDescr given a known vendor
   */
  private extractModel(sysDescr: string, vendor: string): string {
    // Try to find a model pattern like "XGS 3100", "ASR 1001", etc.
    const modelMatch = sysDescr.match(/\b([A-Z]{2,}[\s-]?\d+\w*)\b/i);
    return modelMatch ? modelMatch[1] : `${vendor} Device`;
  }

  /**
   * Discover interfaces by walking IF-MIB
   */
  private async discoverInterfaces(
    ip: string,
    community: string,
  ): Promise<DiscoveredInterface[]> {
    try {
      const [descrVbs, typeVbs, speedVbs, operVbs, adminVbs, nameVbs] =
        await Promise.all([
          this.snmpWalk(ip, community, IF_MIB.ifDescr),
          this.snmpWalk(ip, community, IF_MIB.ifType),
          this.snmpWalk(ip, community, IF_MIB.ifSpeed),
          this.snmpWalk(ip, community, IF_MIB.ifOperStatus),
          this.snmpWalk(ip, community, IF_MIB.ifAdminStatus),
          this.snmpWalk(ip, community, IF_MIB.ifName),
        ]);

      const getIndex = (oid: string) => {
        const parts = oid.split('.');
        return parseInt(parts[parts.length - 1], 10);
      };

      const descrMap = new Map(descrVbs.map((vb) => [getIndex(vb.oid), vb.value?.toString() || '']));
      const typeMap = new Map(typeVbs.map((vb) => [getIndex(vb.oid), parseInt(vb.value?.toString() || '0')]));
      const speedMap = new Map(speedVbs.map((vb) => [getIndex(vb.oid), parseInt(vb.value?.toString() || '0')]));
      const operMap = new Map(operVbs.map((vb) => [getIndex(vb.oid), parseInt(vb.value?.toString() || '0')]));
      const adminMap = new Map(adminVbs.map((vb) => [getIndex(vb.oid), parseInt(vb.value?.toString() || '0')]));
      const nameMap = new Map(nameVbs.map((vb) => [getIndex(vb.oid), vb.value?.toString() || '']));

      const operStatusStr = (val: number): string => {
        switch (val) {
          case 1: return 'up';
          case 2: return 'down';
          case 3: return 'testing';
          default: return 'unknown';
        }
      };

      const adminStatusStr = (val: number): string => {
        switch (val) {
          case 1: return 'up';
          case 2: return 'down';
          case 3: return 'testing';
          default: return 'unknown';
        }
      };

      const interfaces: DiscoveredInterface[] = [];

      for (const [idx, descr] of descrMap) {
        interfaces.push({
          interfaceName: nameMap.get(idx) || descr,
          interfaceIndex: idx,
          interfaceType: typeMap.get(idx) || 0,
          speedMbps: Math.round((speedMap.get(idx) || 0) / 1_000_000),
          operationalStatus: operStatusStr(operMap.get(idx) || 0),
          adminStatus: adminStatusStr(adminMap.get(idx) || 0),
        });
      }

      return interfaces;
    } catch (err: any) {
      this.logger.warn(`Interface discovery failed for ${ip}: ${err.message}`);
      return [];
    }
  }

  /**
   * SNMP GET helper — wraps snmpService's private method via direct net-snmp
   */
  private snmpGet(ip: string, community: string, oids: string[]): Promise<any[] | null> {
    const snmp = require('net-snmp');
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        retries: 1,
        timeout: 3000,
        version: snmp.Version2c,
      });

      const timer = setTimeout(() => {
        try { session.close(); } catch (_) { /* ignore */ }
        resolve(null);
      }, 4000);

      session.get(oids, (error: any, varbinds: any[]) => {
        clearTimeout(timer);
        try { session.close(); } catch (_) { /* ignore */ }
        resolve(error ? null : varbinds);
      });
    });
  }

  /**
   * SNMP Walk helper
   */
  private snmpWalk(ip: string, community: string, baseOid: string): Promise<any[]> {
    const snmp = require('net-snmp');
    return new Promise((resolve) => {
      const results: any[] = [];
      const session = snmp.createSession(ip, community, {
        port: 161,
        retries: 1,
        timeout: 3000,
        version: snmp.Version2c,
      });

      const timer = setTimeout(() => {
        try { session.close(); } catch (_) { /* ignore */ }
        resolve(results);
      }, 6000);

      session.subtree(
        baseOid,
        (varbinds: any[]) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) {
              results.push(vb);
            }
          }
        },
        () => {
          clearTimeout(timer);
          try { session.close(); } catch (_) { /* ignore */ }
          resolve(results);
        },
      );
    });
  }
}
