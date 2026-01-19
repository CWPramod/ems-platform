export const APMConfig = {
  healthCheck: {
    intervalSeconds: 30, // Health check every 30 seconds
    timeout: 5000, // 5 second timeout
  },
  metrics: {
    retentionDays: 7,
    aggregationIntervalMinutes: 5,
  },
  thresholds: {
    responseTime: {
      warning: 1000, // 1 second
      critical: 3000, // 3 seconds
    },
    errorRate: {
      warning: 0.05, // 5%
      critical: 0.10, // 10%
    },
    throughput: {
      low: 10, // requests per minute
    },
  },
};