import { Injectable, Logger } from '@nestjs/common';
import * as snmp from 'net-snmp';

export interface SnmpDeviceInfo {
  sysDescr: string;
  sysObjectID: string;
  sysUpTime: number;
  sysName: string;
  sysLocation: string;
  manufacturer?: string;
  model?: string;
  isSophos?: boolean;
  firmwareVersion?: string;
}

export interface SnmpMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  uptimeSeconds: number;
  interfaceCount?: number;
  liveUsers?: number;
  activeConnections?: number;
}

// Sophos Enterprise OIDs
const SOPHOS_OIDS = {
  sfosDeviceName: '1.3.6.1.4.1.2604.5.1.1.1.0',
  sfosDeviceType: '1.3.6.1.4.1.2604.5.1.1.2.0',
  sfosDeviceFWVersion: '1.3.6.1.4.1.2604.5.1.1.3.0',
  sfosLiveUsersCount: '1.3.6.1.4.1.2604.5.1.2.1.0',
  sfosHTTPHits: '1.3.6.1.4.1.2604.5.1.2.2.0',
};

@Injectable()
export class SnmpPollingService {
  private readonly logger = new Logger(SnmpPollingService.name);

  // Standard SNMP OIDs
  private readonly OIDs = {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    ifNumber: '1.3.6.1.2.1.2.1.0',
    // Walk bases
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    hrStorageType: '1.3.6.1.2.1.25.2.3.1.2',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
  };

  private readonly HR_STORAGE_RAM = '1.3.6.1.2.1.25.2.1.2';

  /**
   * Poll device for basic information
   */
  async pollDevice(
    ipAddress: string,
    community: string = 'public',
    version: string = '2c',
    port: number = 161,
  ): Promise<SnmpDeviceInfo> {
    return new Promise((resolve, reject) => {
      const session = this.createSession(ipAddress, community, version, port);
      const oids = [
        this.OIDs.sysDescr,
        this.OIDs.sysObjectID,
        this.OIDs.sysUpTime,
        this.OIDs.sysName,
        this.OIDs.sysLocation,
      ];

      session.get(oids, (error, varbinds) => {
        if (error) {
          this.logger.error(`SNMP poll failed for ${ipAddress}: ${error.message}`);
          session.close();
          reject(error);
          return;
        }

        try {
          const sysDescr = varbinds[0]?.value?.toString() || '';
          const isSophos = sysDescr.toLowerCase().includes('sophos') ||
            sysDescr.toLowerCase().includes('sfos') ||
            sysDescr.toLowerCase().includes('cyberoam');

          const deviceInfo: SnmpDeviceInfo = {
            sysDescr,
            sysObjectID: varbinds[1]?.value?.toString() || '',
            sysUpTime: parseInt(varbinds[2]?.value?.toString() || '0') / 100,
            sysName: varbinds[3]?.value?.toString() || '',
            sysLocation: varbinds[4]?.value?.toString() || '',
            isSophos,
          };

          // Parse manufacturer and model
          if (isSophos) {
            deviceInfo.manufacturer = 'Sophos';
            const modelMatch = sysDescr.match(/\b(XGS?\s*\d+\w?)\b/i);
            deviceInfo.model = modelMatch ? modelMatch[1].toUpperCase() : 'XG Firewall';
          } else {
            const descParts = sysDescr.split(' ');
            if (descParts.length >= 2) {
              deviceInfo.manufacturer = descParts[0];
              deviceInfo.model = descParts[1];
            }
          }

          session.close();
          resolve(deviceInfo);
        } catch (err) {
          session.close();
          reject(err);
        }
      });
    });
  }

  /**
   * Collect metrics from device — uses SNMP walk for CPU and memory
   */
  async collectMetrics(
    ipAddress: string,
    community: string = 'public',
    version: string = '2c',
    port: number = 161,
  ): Promise<SnmpMetrics> {
    // Get scalar OIDs
    const scalarResult = await this.snmpGet(
      ipAddress, community, version, port,
      [this.OIDs.sysUpTime, this.OIDs.ifNumber],
    );

    const uptimeSeconds = scalarResult
      ? parseInt(scalarResult[0]?.value?.toString() || '0') / 100
      : 0;
    const interfaceCount = scalarResult
      ? parseInt(scalarResult[1]?.value?.toString() || '0')
      : undefined;

    // Walk CPU load
    const cpuUsage = await this.walkCpuLoad(ipAddress, community, version, port);

    // Walk memory usage
    const memoryUsage = await this.walkMemoryUsage(ipAddress, community, version, port);

    // Try Sophos-specific OIDs (best-effort)
    let liveUsers: number | undefined;
    const sophosResult = await this.snmpGet(
      ipAddress, community, version, port,
      [SOPHOS_OIDS.sfosLiveUsersCount],
    );
    if (sophosResult && !snmp.isVarbindError(sophosResult[0])) {
      liveUsers = parseInt(sophosResult[0]?.value?.toString() || '0');
    }

    return {
      uptimeSeconds,
      interfaceCount: interfaceCount && interfaceCount > 0 ? interfaceCount : undefined,
      cpuUsage: cpuUsage > 0 ? cpuUsage : undefined,
      memoryUsage: memoryUsage > 0 ? memoryUsage : undefined,
      liveUsers,
    };
  }

  /**
   * Walk hrProcessorLoad and average across processors
   */
  private async walkCpuLoad(
    ipAddress: string, community: string, version: string, port: number,
  ): Promise<number> {
    try {
      const varbinds = await this.snmpWalk(ipAddress, community, version, port, this.OIDs.hrProcessorLoad);
      if (varbinds.length === 0) return 0;

      const loads = varbinds.map((vb) => parseInt(vb.value?.toString() || '0'));
      return loads.reduce((sum, v) => sum + v, 0) / loads.length;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Walk hrStorage to find RAM utilization
   */
  private async walkMemoryUsage(
    ipAddress: string, community: string, version: string, port: number,
  ): Promise<number> {
    try {
      const [typeVbs, sizeVbs, usedVbs] = await Promise.all([
        this.snmpWalk(ipAddress, community, version, port, this.OIDs.hrStorageType),
        this.snmpWalk(ipAddress, community, version, port, this.OIDs.hrStorageSize),
        this.snmpWalk(ipAddress, community, version, port, this.OIDs.hrStorageUsed),
      ]);

      const getIdx = (oid: string) => oid.split('.').pop();
      const typeMap = new Map(typeVbs.map((vb) => [getIdx(vb.oid), vb.value?.toString()]));
      const sizeMap = new Map(sizeVbs.map((vb) => [getIdx(vb.oid), parseInt(vb.value?.toString() || '0')]));
      const usedMap = new Map(usedVbs.map((vb) => [getIdx(vb.oid), parseInt(vb.value?.toString() || '0')]));

      for (const [idx, typeOid] of typeMap) {
        if (typeOid === this.HR_STORAGE_RAM) {
          const size = sizeMap.get(idx) || 0;
          const used = usedMap.get(idx) || 0;
          if (size > 0) return (used / size) * 100;
        }
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Test if device is reachable via SNMP
   */
  async testConnection(
    ipAddress: string,
    community: string = 'public',
    version: string = '2c',
    port: number = 161,
  ): Promise<boolean> {
    try {
      await this.pollDevice(ipAddress, community, version, port);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * SNMP GET for specific OIDs
   */
  private snmpGet(
    ipAddress: string, community: string, version: string, port: number,
    oids: string[],
  ): Promise<any[] | null> {
    return new Promise((resolve) => {
      let responded = false;
      const session = this.createSession(ipAddress, community, version, port);

      const timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          try { session.close(); } catch (_) { /* ignore */ }
          resolve(null);
        }
      }, 6000);

      session.get(oids, (error, varbinds) => {
        if (!responded) {
          responded = true;
          clearTimeout(timer);
          try { session.close(); } catch (_) { /* ignore */ }
          resolve(error ? null : varbinds);
        }
      });
    });
  }

  /**
   * SNMP Walk — subtree traversal
   */
  private snmpWalk(
    ipAddress: string, community: string, version: string, port: number,
    baseOid: string,
  ): Promise<any[]> {
    return new Promise((resolve) => {
      const results: any[] = [];
      let responded = false;
      const session = this.createSession(ipAddress, community, version, port);

      const timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          try { session.close(); } catch (_) { /* ignore */ }
          resolve(results);
        }
      }, 8000);

      session.subtree(
        baseOid,
        (varbinds) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) {
              results.push(vb);
            }
          }
        },
        (error) => {
          if (!responded) {
            responded = true;
            clearTimeout(timer);
            try { session.close(); } catch (_) { /* ignore */ }
            resolve(results);
          }
        },
      );
    });
  }

  /**
   * Create SNMP session
   */
  private createSession(
    ipAddress: string,
    community: string,
    version: string,
    port: number,
  ): snmp.Session {
    const options: any = {
      port,
      retries: 2,
      timeout: 5000,
      version: version === '1' ? snmp.Version1 : snmp.Version2c,
    };

    return snmp.createSession(ipAddress, community, options);
  }
}
