import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

@Injectable()
export class EmsCoreClient {
  private readonly logger = new Logger(EmsCoreClient.name);
  private readonly client: AxiosInstance;
  private readonly circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };

  private readonly maxFailures = 5;
  private readonly recoveryTimeMs = 30000;
  private readonly maxRetries = 3;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('EMS_CORE_URL', 'http://api:3100/api/v1');
    const apiKey = this.configService.get<string>('ITSM_MODULE_API_KEY', '');

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Module-Key': apiKey,
      },
    });
  }

  async getAsset(assetId: string): Promise<any> {
    return this.requestWithRetry('GET', `/assets/${assetId}`);
  }

  async getAlert(alertId: string): Promise<any> {
    return this.requestWithRetry('GET', `/alerts/${alertId}`);
  }

  async patchAlert(alertId: string, data: Record<string, any>): Promise<any> {
    return this.requestWithRetry('PATCH', `/alerts/${alertId}`, data);
  }

  async getUser(userId: string): Promise<any> {
    return this.requestWithRetry('GET', `/users/${userId}`);
  }

  async getOperators(): Promise<any> {
    return this.requestWithRetry('GET', '/users?role=operator');
  }

  private async requestWithRetry(
    method: string,
    url: string,
    data?: any,
  ): Promise<any> {
    // Circuit breaker check
    if (this.circuitBreaker.isOpen) {
      if (Date.now() - this.circuitBreaker.lastFailure > this.recoveryTimeMs) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        this.logger.log('Circuit breaker closed, resuming requests');
      } else {
        this.logger.warn('Circuit breaker open, rejecting request');
        return null;
      }
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.request({ method, url, data });
        // Reset on success
        this.circuitBreaker.failures = 0;
        return response.data;
      } catch (err: any) {
        const status = (err as AxiosError)?.response?.status;
        this.logger.warn(
          `EMS Core request failed (attempt ${attempt}/${this.maxRetries}): ${method} ${url} — ${status || err.message}`,
        );

        if (attempt === this.maxRetries) {
          this.circuitBreaker.failures++;
          this.circuitBreaker.lastFailure = Date.now();

          if (this.circuitBreaker.failures >= this.maxFailures) {
            this.circuitBreaker.isOpen = true;
            this.logger.error(
              `Circuit breaker OPEN after ${this.maxFailures} consecutive failures`,
            );
          }
          return null;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 200;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return null;
  }
}
