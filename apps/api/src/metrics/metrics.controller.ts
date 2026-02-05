import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Metric } from '../entities/metric.entity';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() metricData: Partial<Metric>): Promise<Metric> {
    return await this.metricsService.create(metricData);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Body('metrics') metricsData: Partial<Metric>[],
  ): Promise<{ accepted: number; rejected: number }> {
    return await this.metricsService.createBatch(metricsData);
  }

  @Get()
  async query(
    @Query('assetId') assetId?: string,
    @Query('metricName') metricName?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('aggregation') aggregation?: string,
  ): Promise<{ data: Array<{ timestamp: Date; value: number }> }> {
    const filters = {
      assetId,
      metricName,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      aggregation,
    };

    const data = await this.metricsService.query(filters);
    return { data };
  }
}