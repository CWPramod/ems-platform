import { Injectable, Logger } from '@nestjs/common';
import { APMConfig } from '../apm.config';

export interface ApplicationHealth {
  applicationName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  uptime: number;
  lastCheck: Date;
  errorRate: number;
  throughput: number;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  type: 'database' | 'api' | 'cache' | 'queue';
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: Date;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private applications: Map<string, ApplicationHealth> = new Map();

  /**
   * Check application health
   */
  async checkApplicationHealth(appName: string): Promise<ApplicationHealth> {
    try {
      this.logger.log(`Checking health for application: ${appName}`);

      // In real implementation, this would make actual HTTP requests
      // For demo, we'll use mock data
      const health = this.getMockApplicationHealth(appName);
      
      this.applications.set(appName, health);
      
      return health;
    } catch (error) {
      this.logger.error(`Failed to check health for ${appName}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all monitored applications
   */
  async getAllApplications(): Promise<ApplicationHealth[]> {
    // Return mock applications
    const apps = [
      'payment-api',
      'user-service',
      'order-service',
      'notification-service',
    ];

    const healthChecks = await Promise.all(
      apps.map((app) => this.checkApplicationHealth(app))
    );

    return healthChecks;
  }

  /**
   * Get application by name
   */
  getApplication(appName: string): ApplicationHealth | undefined {
    return this.applications.get(appName);
  }

  /**
   * Mock application health data for demo
   */
  private getMockApplicationHealth(appName: string): ApplicationHealth {
    const now = new Date();
    const responseTime = 100 + Math.random() * 400; // 100-500ms
    const errorRate = Math.random() * 0.03; // 0-3%
    const throughput = 50 + Math.random() * 100; // 50-150 req/min

    // Determine status based on thresholds
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    
    if (responseTime > APMConfig.thresholds.responseTime.critical || 
        errorRate > APMConfig.thresholds.errorRate.critical) {
      status = 'down';
    } else if (responseTime > APMConfig.thresholds.responseTime.warning || 
               errorRate > APMConfig.thresholds.errorRate.warning) {
      status = 'degraded';
    }

    // Add some variance for specific apps
    if (appName === 'payment-api') {
      // Payment API is critical, should be very healthy
      return {
        applicationName: appName,
        status: 'healthy',
        responseTime: 150,
        uptime: 0.9999, // 99.99% uptime
        lastCheck: now,
        errorRate: 0.001, // 0.1%
        throughput: 120,
        dependencies: [
          {
            name: 'payment-gateway',
            type: 'api',
            status: 'healthy',
            responseTime: 200,
            lastCheck: now,
          },
          {
            name: 'payment-db',
            type: 'database',
            status: 'healthy',
            responseTime: 50,
            lastCheck: now,
          },
          {
            name: 'redis-cache',
            type: 'cache',
            status: 'healthy',
            responseTime: 10,
            lastCheck: now,
          },
        ],
      };
    }

    if (appName === 'user-service') {
      return {
        applicationName: appName,
        status: 'healthy',
        responseTime: 180,
        uptime: 0.998, // 99.8% uptime
        lastCheck: now,
        errorRate: 0.005, // 0.5%
        throughput: 200,
        dependencies: [
          {
            name: 'user-db',
            type: 'database',
            status: 'healthy',
            responseTime: 80,
            lastCheck: now,
          },
          {
            name: 'auth-service',
            type: 'api',
            status: 'healthy',
            responseTime: 120,
            lastCheck: now,
          },
        ],
      };
    }

    if (appName === 'order-service') {
      // Order service showing degraded performance
      return {
        applicationName: appName,
        status: 'degraded',
        responseTime: 1200, // Slow response
        uptime: 0.995,
        lastCheck: now,
        errorRate: 0.08, // 8% error rate
        throughput: 45,
        dependencies: [
          {
            name: 'order-db',
            type: 'database',
            status: 'degraded',
            responseTime: 800,
            lastCheck: now,
          },
          {
            name: 'inventory-api',
            type: 'api',
            status: 'healthy',
            responseTime: 150,
            lastCheck: now,
          },
        ],
      };
    }

    // Default mock data
    return {
      applicationName: appName,
      status,
      responseTime: Math.round(responseTime),
      uptime: 0.996 + Math.random() * 0.003, // 99.6-99.9%
      lastCheck: now,
      errorRate: Math.round(errorRate * 1000) / 1000,
      throughput: Math.round(throughput),
      dependencies: [
        {
          name: `${appName}-db`,
          type: 'database',
          status: 'healthy',
          responseTime: Math.round(50 + Math.random() * 100),
          lastCheck: now,
        },
      ],
    };
  }
}