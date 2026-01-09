import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Metric } from '../entities/metric.entity';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Metric)
    private metricsRepository: Repository<Metric>,
  ) {}

  async create(metricData: Partial<Metric>): Promise<Metric> {
    const metric = this.metricsRepository.create(metricData);
    return await this.metricsRepository.save(metric);
  }

  async createBatch(metricsData: Partial<Metric>[]): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;

    for (const metricData of metricsData) {
      try {
        await this.create(metricData);
        accepted++;
      } catch (error) {
        rejected++;
      }
    }

    return { accepted, rejected };
  }

  async query(filters: {
    assetId?: string;
    metricName?: string;
    from?: Date;
    to?: Date;
    aggregation?: string;
  }): Promise<Array<{ timestamp: Date; value: number }>> {
    const queryBuilder = this.metricsRepository
      .createQueryBuilder('metric')
      .select('metric.timestamp', 'timestamp')
      .addSelect('metric.value', 'value');

    if (filters.assetId) {
      queryBuilder.andWhere('metric.assetId = :assetId', { assetId: filters.assetId });
    }

    if (filters.metricName) {
      queryBuilder.andWhere('metric.metricName = :metricName', { metricName: filters.metricName });
    }

    if (filters.from && filters.to) {
      queryBuilder.andWhere('metric.timestamp BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    }

    queryBuilder.orderBy('metric.timestamp', 'ASC');

    return await queryBuilder.getRawMany();
  }
}