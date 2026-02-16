import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SnmpPollerService } from './snmp-poller.service.js';
import { ApiPusherService } from './api-pusher.service.js';
import { RAILTEL_DEVICES, getProbeConfig } from './config.js';

@Injectable()
export class ProbeOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ProbeOrchestratorService.name);
  private pollCount = 0;

  constructor(
    private readonly snmpPoller: SnmpPollerService,
    private readonly apiPusher: ApiPusherService,
  ) {}

  async onModuleInit() {
    const config = getProbeConfig();
    this.logger.log(`Probe "${config.probeId}" starting — ${RAILTEL_DEVICES.length} devices configured`);
    this.logger.log(`Target API: ${config.emsApiUrl}`);
    this.logger.log(`Devices:`);
    for (const d of RAILTEL_DEVICES) {
      this.logger.log(`  - ${d.name} (${d.ip})`);
    }

    // Run first poll immediately on startup
    this.logger.log('Running initial poll...');
    await this.pollAndPush();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollAndPush(): Promise<void> {
    this.pollCount++;
    this.logger.log(`--- Poll cycle #${this.pollCount} ---`);

    try {
      // 1. Poll all devices via SNMP
      const results = await this.snmpPoller.pollAllDevices();

      const online = results.filter((r) => r.isOnline).length;
      const snmpOk = results.filter((r) => r.snmpReachable).length;
      this.logger.log(
        `Polled ${results.length}/${RAILTEL_DEVICES.length} devices — ${online} online, ${snmpOk} SNMP reachable`,
      );

      if (results.length === 0) {
        this.logger.warn('No devices returned metrics — skipping push');
        return;
      }

      // 2. Push batch to central API
      const pushed = await this.apiPusher.push(results);

      if (pushed) {
        this.logger.log(`Cycle #${this.pollCount} complete — data pushed successfully`);
      } else {
        this.logger.warn(
          `Cycle #${this.pollCount} complete — push failed, buffered (buffer: ${this.apiPusher.getBufferSize()})`,
        );
      }
    } catch (error) {
      this.logger.error(`Poll cycle #${this.pollCount} error: ${error.message}`);
    }
  }

  getPollCount(): number {
    return this.pollCount;
  }
}
