import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { getProbeConfig } from './config.js';
import { DeviceMetricsResult } from './snmp-poller.service.js';

interface BufferedPayload {
  probeId: string;
  timestamp: string;
  devices: DeviceMetricsResult[];
  attempts: number;
  nextRetryAt: number;
}

@Injectable()
export class ApiPusherService implements OnModuleDestroy {
  private readonly logger = new Logger(ApiPusherService.name);
  private readonly client: AxiosInstance;
  private readonly buffer: BufferedPayload[] = [];
  private readonly maxBufferSize = 100;
  private readonly maxAttempts = 5;
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private apiReachable = true;

  constructor() {
    const config = getProbeConfig();
    this.client = axios.create({
      baseURL: config.emsApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Probe-Api-Key': config.probeApiKey,
      },
    });

    // Start buffer drain loop (every 5 seconds)
    this.drainTimer = setInterval(() => this.drainBuffer(), 5000);
    this.logger.log(`API Pusher initialized — target: ${config.emsApiUrl}`);
  }

  onModuleDestroy() {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
    }
  }

  async push(devices: DeviceMetricsResult[]): Promise<boolean> {
    const config = getProbeConfig();
    const payload = {
      probeId: config.probeId,
      timestamp: new Date().toISOString(),
      devices,
    };

    try {
      const response = await this.client.post('/api/v1/probe/ingest', payload);

      if (response.status === 200) {
        if (!this.apiReachable) {
          this.logger.log('API connection restored — draining buffer...');
          this.apiReachable = true;
        }
        this.logger.log(
          `Pushed ${devices.length} device(s) — processed: ${response.data.processed}`,
        );
        return true;
      }
    } catch (error) {
      if (this.apiReachable) {
        this.logger.warn(`API unreachable: ${error.message} — buffering payloads`);
        this.apiReachable = false;
      }
    }

    // Buffer the payload for retry
    this.addToBuffer({
      ...payload,
      attempts: 0,
      nextRetryAt: Date.now() + 2000, // first retry in 2s
    });
    return false;
  }

  private addToBuffer(payload: BufferedPayload): void {
    if (this.buffer.length >= this.maxBufferSize) {
      // Drop oldest payload (circular buffer behavior)
      const dropped = this.buffer.shift();
      this.logger.warn(
        `Buffer full (${this.maxBufferSize}) — dropped oldest payload from ${dropped?.timestamp}`,
      );
    }
    this.buffer.push(payload);
    this.logger.debug(`Buffered payload — buffer size: ${this.buffer.length}`);
  }

  private async drainBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const now = Date.now();
    const ready = this.buffer.filter((p) => p.nextRetryAt <= now);

    for (const payload of ready) {
      try {
        const response = await this.client.post('/api/v1/probe/ingest', {
          probeId: payload.probeId,
          timestamp: payload.timestamp,
          devices: payload.devices,
        });

        if (response.status === 200) {
          // Remove from buffer on success
          const idx = this.buffer.indexOf(payload);
          if (idx !== -1) this.buffer.splice(idx, 1);

          if (!this.apiReachable) {
            this.logger.log('API connection restored');
            this.apiReachable = true;
          }

          this.logger.log(
            `Buffer drain: sent payload from ${payload.timestamp} — ${this.buffer.length} remaining`,
          );
        }
      } catch (error) {
        payload.attempts++;
        if (payload.attempts >= this.maxAttempts) {
          // Drop after max attempts
          const idx = this.buffer.indexOf(payload);
          if (idx !== -1) this.buffer.splice(idx, 1);
          this.logger.warn(
            `Dropped payload from ${payload.timestamp} after ${this.maxAttempts} failed attempts`,
          );
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const delay = Math.pow(2, payload.attempts + 1) * 1000;
          payload.nextRetryAt = now + delay;
          this.logger.debug(
            `Retry ${payload.attempts}/${this.maxAttempts} for ${payload.timestamp} — next in ${delay / 1000}s`,
          );
        }
      }
    }
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  isApiReachable(): boolean {
    return this.apiReachable;
  }
}
