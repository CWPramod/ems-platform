import { Injectable, Logger } from '@nestjs/common';

export interface APMMetric {
  applicationName: string;
  metricType: 'response_time' | 'error_rate' | 'throughput' | 'cpu' | 'memory';
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricTimeSeries {
  metricType: string;
  dataPoints: Array<{
    timestamp: Date;
    value: number;
  }>;
  unit: string;
  aggregation: 'avg' | 'sum' | 'min' | 'max';
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, APMMetric[]> = new Map();

  /**
   * Record a metric
   */
  recordMetric(metric: Omit<APMMetric, 'timestamp'>): APMMetric {
    const fullMetric: APMMetric = {
      ...metric,
      timestamp: new Date(),
    };

    const appMetrics = this.metrics.get(metric.applicationName) || [];
    appMetrics.push(fullMetric);

    // Keep only last 10000 metrics per app
    if (appMetrics.length > 10000) {
      appMetrics.shift();
    }

    this.metrics.set(metric.applicationName, appMetrics);

    return fullMetric;
  }

  /**
   * Get metrics for an application
   */
  getMetrics(
    applicationName: string,
    metricType?: string,
    hours: number = 1
  ): APMMetric[] {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    let metrics = this.metrics.get(applicationName) || [];

    // Filter by type if specified
    if (metricType) {
      metrics = metrics.filter((m) => m.metricType === metricType);
    }

    // Filter by time range
    metrics = metrics.filter((m) => m.timestamp >= since);

    return metrics;
  }

  /**
   * Get response time metrics over time
   */
  getResponseTimeMetrics(
    applicationName: string,
    hours: number = 1
  ): MetricTimeSeries {
    const metrics = this.getMetrics(applicationName, 'response_time', hours);

    if (metrics.length === 0) {
      return this.getMockResponseTimeMetrics(applicationName, hours);
    }

    return {
      metricType: 'response_time',
      dataPoints: metrics.map((m) => ({
        timestamp: m.timestamp,
        value: m.value,
      })),
      unit: 'ms',
      aggregation: 'avg',
    };
  }

  /**
   * Get error rate metrics over time
   */
  getErrorRateMetrics(
    applicationName: string,
    hours: number = 1
  ): MetricTimeSeries {
    const metrics = this.getMetrics(applicationName, 'error_rate', hours);

    if (metrics.length === 0) {
      return this.getMockErrorRateMetrics(applicationName, hours);
    }

    return {
      metricType: 'error_rate',
      dataPoints: metrics.map((m) => ({
        timestamp: m.timestamp,
        value: m.value,
      })),
      unit: 'percent',
      aggregation: 'avg',
    };
  }

  /**
   * Get throughput metrics over time
   */
  getThroughputMetrics(
    applicationName: string,
    hours: number = 1
  ): MetricTimeSeries {
    const metrics = this.getMetrics(applicationName, 'throughput', hours);

    if (metrics.length === 0) {
      return this.getMockThroughputMetrics(applicationName, hours);
    }

    return {
      metricType: 'throughput',
      dataPoints: metrics.map((m) => ({
        timestamp: m.timestamp,
        value: m.value,
      })),
      unit: 'req/min',
      aggregation: 'sum',
    };
  }

  /**
   * Get all metrics summary for an application
   */
  getMetricsSummary(applicationName: string, hours: number = 1) {
    const responseTimeMetrics = this.getResponseTimeMetrics(applicationName, hours);
    const errorRateMetrics = this.getErrorRateMetrics(applicationName, hours);
    const throughputMetrics = this.getThroughputMetrics(applicationName, hours);

    return {
      applicationName,
      timeRange: `${hours} hours`,
      responseTime: responseTimeMetrics,
      errorRate: errorRateMetrics,
      throughput: throughputMetrics,
    };
  }

  /**
   * Mock response time metrics
   */
  private getMockResponseTimeMetrics(
    applicationName: string,
    hours: number
  ): MetricTimeSeries {
   const dataPoints: { timestamp: Date; value: number }[] = [];
    const now = Date.now();
    const intervalMs = (hours * 60 * 60 * 1000) / 20; // 20 data points

    let baseResponseTime = 200;
    if (applicationName === 'payment-api') {
      baseResponseTime = 150;
    } else if (applicationName === 'order-service') {
      baseResponseTime = 1200;
    } else if (applicationName === 'user-service') {
      baseResponseTime = 180;
    }

    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now - (19 - i) * intervalMs);
      const variance = (Math.random() - 0.5) * 100;
      const value = Math.max(50, baseResponseTime + variance);

      dataPoints.push({
        timestamp,
        value: Math.round(value),
      });
    }

    return {
      metricType: 'response_time',
      dataPoints,
      unit: 'ms',
      aggregation: 'avg',
    };
  }

  /**
   * Mock error rate metrics
   */
  private getMockErrorRateMetrics(
    applicationName: string,
    hours: number
  ): MetricTimeSeries {
    const dataPoints: { timestamp: Date; value: number }[] = [];
    const now = Date.now();
    const intervalMs = (hours * 60 * 60 * 1000) / 20;

    let baseErrorRate = 2; // 2%
    if (applicationName === 'payment-api') {
      baseErrorRate = 0.1;
    } else if (applicationName === 'order-service') {
      baseErrorRate = 8;
    } else if (applicationName === 'user-service') {
      baseErrorRate = 0.5;
    }

    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now - (19 - i) * intervalMs);
      const variance = (Math.random() - 0.5) * 2;
      const value = Math.max(0, baseErrorRate + variance);

      dataPoints.push({
        timestamp,
        value: Math.round(value * 100) / 100,
      });
    }

    return {
      metricType: 'error_rate',
      dataPoints,
      unit: 'percent',
      aggregation: 'avg',
    };
  }

  /**
   * Mock throughput metrics
   */
  private getMockThroughputMetrics(
    applicationName: string,
    hours: number
  ): MetricTimeSeries {
    const dataPoints: { timestamp: Date; value: number }[] = [];
    const now = Date.now();
    const intervalMs = (hours * 60 * 60 * 1000) / 20;

    let baseThroughput = 100;
    if (applicationName === 'payment-api') {
      baseThroughput = 120;
    } else if (applicationName === 'order-service') {
      baseThroughput = 45;
    } else if (applicationName === 'user-service') {
      baseThroughput = 200;
    }

    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now - (19 - i) * intervalMs);
      const variance = (Math.random() - 0.5) * 40;
      const value = Math.max(10, baseThroughput + variance);

      dataPoints.push({
        timestamp,
        value: Math.round(value),
      });
    }

    return {
      metricType: 'throughput',
      dataPoints,
      unit: 'req/min',
      aggregation: 'sum',
    };
  }
}