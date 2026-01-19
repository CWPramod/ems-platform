import { Injectable, Logger } from '@nestjs/common';

export interface Transaction {
  id: string;
  applicationName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface TransactionSummary {
  applicationName: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  timeRange: string;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  private transactions: Map<string, Transaction[]> = new Map();

  /**
   * Record a transaction
   */
  recordTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
    const fullTransaction: Transaction = {
      ...transaction,
      id: this.generateId(),
      timestamp: new Date(),
    };

    const appTransactions = this.transactions.get(transaction.applicationName) || [];
    appTransactions.push(fullTransaction);
    
    // Keep only last 1000 transactions per app
    if (appTransactions.length > 1000) {
      appTransactions.shift();
    }
    
    this.transactions.set(transaction.applicationName, appTransactions);

    return fullTransaction;
  }

  /**
   * Get transactions for an application
   */
  getTransactions(
    applicationName: string,
    limit: number = 100,
    filters?: {
      success?: boolean;
      minResponseTime?: number;
      maxResponseTime?: number;
      since?: Date;
    }
  ): Transaction[] {
    let transactions = this.transactions.get(applicationName) || [];

    // Apply filters
    if (filters) {
      transactions = transactions.filter((t) => {
        if (filters.success !== undefined && t.success !== filters.success) return false;
        if (filters.minResponseTime && t.responseTime < filters.minResponseTime) return false;
        if (filters.maxResponseTime && t.responseTime > filters.maxResponseTime) return false;
        if (filters.since && t.timestamp < filters.since) return false;
        return true;
      });
    }

    // Return most recent first
    return transactions.slice(-limit).reverse();
  }

  /**
   * Get transaction summary
   */
  getTransactionSummary(
    applicationName: string,
    hours: number = 1
  ): TransactionSummary {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const transactions = this.getTransactions(applicationName, 10000, { since });

    if (transactions.length === 0) {
      // Return mock data if no real transactions
      return this.getMockTransactionSummary(applicationName, hours);
    }

    const responseTimes = transactions.map((t) => t.responseTime).sort((a, b) => a - b);
    const totalTransactions = transactions.length;
    const successfulTransactions = transactions.filter((t) => t.success).length;
    const failedTransactions = totalTransactions - successfulTransactions;
    const averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / totalTransactions;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    const errorRate = failedTransactions / totalTransactions;
    const throughput = totalTransactions / (hours * 60); // per minute

    return {
      applicationName,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      errorRate: Math.round(errorRate * 1000) / 1000,
      throughput: Math.round(throughput),
      timeRange: `${hours} hours`,
    };
  }

  /**
   * Get slow transactions (above threshold)
   */
  getSlowTransactions(
    applicationName: string,
    thresholdMs: number = 1000,
    limit: number = 50
  ): Transaction[] {
    return this.getTransactions(applicationName, limit, {
      minResponseTime: thresholdMs,
    });
  }

  /**
   * Get failed transactions
   */
  getFailedTransactions(
    applicationName: string,
    limit: number = 50
  ): Transaction[] {
    return this.getTransactions(applicationName, limit, {
      success: false,
    });
  }

  /**
   * Generate mock transaction summary
   */
  private getMockTransactionSummary(
    applicationName: string,
    hours: number
  ): TransactionSummary {
    // Generate realistic mock data based on application name
    let baseResponseTime = 200;
    let baseErrorRate = 0.02; // 2%
    let baseThroughput = 100;

    if (applicationName === 'payment-api') {
      baseResponseTime = 150;
      baseErrorRate = 0.001;
      baseThroughput = 120;
    } else if (applicationName === 'order-service') {
      baseResponseTime = 1200;
      baseErrorRate = 0.08;
      baseThroughput = 45;
    } else if (applicationName === 'user-service') {
      baseResponseTime = 180;
      baseErrorRate = 0.005;
      baseThroughput = 200;
    }

    const totalTransactions = Math.round(baseThroughput * hours * 60);
    const failedTransactions = Math.round(totalTransactions * baseErrorRate);
    const successfulTransactions = totalTransactions - failedTransactions;

    return {
      applicationName,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      averageResponseTime: baseResponseTime,
      p95ResponseTime: Math.round(baseResponseTime * 1.5),
      p99ResponseTime: Math.round(baseResponseTime * 2),
      errorRate: baseErrorRate,
      throughput: baseThroughput,
      timeRange: `${hours} hours`,
    };
  }

  /**
   * Generate unique transaction ID
   */
  private generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get mock transactions for demo
   */
  getMockTransactions(applicationName: string, count: number = 20): Transaction[] {
    const transactions: Transaction[] = [];
    const now = Date.now();

    const endpoints = [
      { path: '/api/v1/payments', method: 'POST', avgTime: 150 },
      { path: '/api/v1/orders', method: 'POST', avgTime: 300 },
      { path: '/api/v1/users/:id', method: 'GET', avgTime: 100 },
      { path: '/api/v1/products', method: 'GET', avgTime: 120 },
      { path: '/api/v1/checkout', method: 'POST', avgTime: 500 },
    ];

    for (let i = 0; i < count; i++) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const responseTime = endpoint.avgTime + (Math.random() - 0.5) * 100;
      const success = Math.random() > 0.05; // 95% success rate

      transactions.push({
        id: this.generateId(),
        applicationName,
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: success ? 200 : (Math.random() > 0.5 ? 500 : 404),
        responseTime: Math.round(Math.max(50, responseTime)),
        timestamp: new Date(now - (count - i) * 5000), // 5 seconds apart
        success,
        errorMessage: success ? undefined : 'Internal server error',
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        metadata: {
          region: Math.random() > 0.5 ? 'us-east-1' : 'us-west-2',
        },
      });
    }

    return transactions.reverse();
  }
}