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
}

export interface SnmpMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  uptimeSeconds: number;
  interfaceCount?: number;
}

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
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
  };

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
          const deviceInfo: SnmpDeviceInfo = {
            sysDescr: varbinds[0]?.value?.toString() || '',
            sysObjectID: varbinds[1]?.value?.toString() || '',
            sysUpTime: parseInt(varbinds[2]?.value?.toString() || '0') / 100,
            sysName: varbinds[3]?.value?.toString() || '',
            sysLocation: varbinds[4]?.value?.toString() || '',
          };

          // Parse manufacturer and model from sysDescr
          const descParts = deviceInfo.sysDescr.split(' ');
          if (descParts.length >= 2) {
            deviceInfo.manufacturer = descParts[0];
            deviceInfo.model = descParts[1];
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
   * Collect metrics from device
   */
  async collectMetrics(
    ipAddress: string,
    community: string = 'public',
    version: string = '2c',
    port: number = 161,
  ): Promise<SnmpMetrics> {
    return new Promise((resolve, reject) => {
      const session = this.createSession(ipAddress, community, version, port);
      const oids = [
        this.OIDs.sysUpTime,
        this.OIDs.ifNumber,
        this.OIDs.hrProcessorLoad + '.1',
        this.OIDs.hrStorageUsed + '.1',
        this.OIDs.hrStorageSize + '.1',
      ];

      session.get(oids, (error, varbinds) => {
        session.close();

        if (error) {
          this.logger.warn(`Metrics collection failed for ${ipAddress}: ${error.message}`);
          // Return partial metrics on error
          resolve({
            uptimeSeconds: 0,
          });
          return;
        }

        const uptimeSeconds = parseInt(varbinds[0]?.value?.toString() || '0') / 100;
        const interfaceCount = parseInt(varbinds[1]?.value?.toString() || '0');
        const cpuLoad = parseInt(varbinds[2]?.value?.toString() || '0');
        const memoryUsed = parseInt(varbinds[3]?.value?.toString() || '0');
        const memorySize = parseInt(varbinds[4]?.value?.toString() || '1');

        resolve({
          uptimeSeconds,
          interfaceCount: interfaceCount > 0 ? interfaceCount : undefined,
          cpuUsage: cpuLoad > 0 ? cpuLoad : undefined,
          memoryUsage: memorySize > 0 ? (memoryUsed / memorySize) * 100 : undefined,
        });
      });
    });
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
