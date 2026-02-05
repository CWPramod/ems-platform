import { Controller, Get, Post, Query, Body, Param, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from '../services/health.service';
import { TransactionService } from '../services/transaction.service';
import { MetricsService } from '../services/metrics.service';

@ApiTags('apm')
@Controller('apm')
export class APMController {
  private readonly logger = new Logger(APMController.name);

  constructor(
    private readonly healthService: HealthService,
    private readonly transactionService: TransactionService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * GET /apm/applications
   * Get all monitored applications
   */
  @Get('applications')
  async getApplications() {
    this.logger.log('Applications list requested');
    const applications = await this.healthService.getAllApplications();
    
    return {
      count: applications.length,
      applications,
    };
  }

  /**
   * GET /apm/applications/:name/health
   * Get application health
   */
  @Get('applications/:name/health')
  async getApplicationHealth(@Param('name') name: string) {
    this.logger.log(`Health check requested for: ${name}`);
    const health = await this.healthService.checkApplicationHealth(name);
    
    return health;
  }

  /**
   * GET /apm/applications/:name/transactions
   * Get transactions for an application
   */
  @Get('applications/:name/transactions')
  async getTransactions(
    @Param('name') name: string,
    @Query('limit') limit?: string,
    @Query('success') success?: string,
  ) {
    this.logger.log(`Transactions requested for: ${name}`);
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    // For demo, return mock transactions
    const transactions = this.transactionService.getMockTransactions(name, limitNum);
    
    return {
      applicationName: name,
      count: transactions.length,
      transactions,
    };
  }

  /**
   * GET /apm/applications/:name/transactions/summary
   * Get transaction summary
   */
  @Get('applications/:name/transactions/summary')
  async getTransactionSummary(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    this.logger.log(`Transaction summary requested for: ${name}`);
    
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    const summary = this.transactionService.getTransactionSummary(name, hoursNum);
    
    return summary;
  }

  /**
   * GET /apm/applications/:name/transactions/slow
   * Get slow transactions
   */
  @Get('applications/:name/transactions/slow')
  async getSlowTransactions(
    @Param('name') name: string,
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Slow transactions requested for: ${name}`);
    
    const thresholdMs = threshold ? parseInt(threshold, 10) : 1000;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    const transactions = this.transactionService.getSlowTransactions(name, thresholdMs, limitNum);
    
    return {
      applicationName: name,
      threshold: `${thresholdMs}ms`,
      count: transactions.length,
      transactions,
    };
  }

  /**
   * GET /apm/applications/:name/transactions/failed
   * Get failed transactions
   */
  @Get('applications/:name/transactions/failed')
  async getFailedTransactions(
    @Param('name') name: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Failed transactions requested for: ${name}`);
    
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const transactions = this.transactionService.getFailedTransactions(name, limitNum);
    
    return {
      applicationName: name,
      count: transactions.length,
      transactions,
    };
  }

  /**
   * POST /apm/applications/:name/transactions
   * Record a transaction (for real APM agent integration)
   */
  @Post('applications/:name/transactions')
  async recordTransaction(
    @Param('name') name: string,
    @Body() body: {
      endpoint: string;
      method: string;
      statusCode: number;
      responseTime: number;
      success: boolean;
      errorMessage?: string;
      userId?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const transaction = this.transactionService.recordTransaction({
      applicationName: name,
      ...body,
    });
    
    return {
      message: 'Transaction recorded',
      transaction,
    };
  }

  /**
   * GET /apm/applications/:name/metrics
   * Get metrics for an application
   */
  @Get('applications/:name/metrics')
  async getMetrics(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    this.logger.log(`Metrics requested for: ${name}`);
    
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    const summary = this.metricsService.getMetricsSummary(name, hoursNum);
    
    return summary;
  }

  /**
   * GET /apm/applications/:name/metrics/response-time
   * Get response time metrics
   */
  @Get('applications/:name/metrics/response-time')
  async getResponseTimeMetrics(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    const metrics = this.metricsService.getResponseTimeMetrics(name, hoursNum);
    
    return {
      applicationName: name,
      ...metrics,
    };
  }

  /**
   * GET /apm/applications/:name/metrics/error-rate
   * Get error rate metrics
   */
  @Get('applications/:name/metrics/error-rate')
  async getErrorRateMetrics(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    const metrics = this.metricsService.getErrorRateMetrics(name, hoursNum);
    
    return {
      applicationName: name,
      ...metrics,
    };
  }

  /**
   * GET /apm/applications/:name/metrics/throughput
   * Get throughput metrics
   */
  @Get('applications/:name/metrics/throughput')
  async getThroughputMetrics(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    const metrics = this.metricsService.getThroughputMetrics(name, hoursNum);
    
    return {
      applicationName: name,
      ...metrics,
    };
  }

  /**
   * POST /apm/applications/:name/metrics
   * Record a metric (for real APM agent integration)
   */
  @Post('applications/:name/metrics')
  async recordMetric(
    @Param('name') name: string,
    @Body() body: {
      metricType: 'response_time' | 'error_rate' | 'throughput' | 'cpu' | 'memory';
      value: number;
      unit: string;
      tags?: Record<string, string>;
    },
  ) {
    const metric = this.metricsService.recordMetric({
      applicationName: name,
      ...body,
    });
    
    return {
      message: 'Metric recorded',
      metric,
    };
  }

  /**
   * GET /apm/status
   * Get APM service status
   */
  @Get('status')
  async getStatus() {
    const applications = await this.healthService.getAllApplications();
    
    return {
      service: 'APM Lite',
      status: 'operational',
      features: {
        healthChecks: true,
        transactionMonitoring: true,
        metricsTracking: true,
        errorTracking: true,
      },
      monitoredApplications: applications.length,
      applications: applications.map((app) => ({
        name: app.applicationName,
        status: app.status,
      })),
    };
  }
}