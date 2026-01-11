import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { MLIntegrationService } from '../services/ml-integration.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    private mlIntegrationService: MLIntegrationService,
  ) {}

  async create(alertData: Partial<Alert>): Promise<Alert> {
    const alert = this.alertsRepository.create({
      ...alertData,
      status: AlertStatus.OPEN,
    });

    // Enhance with ML predictions if ML service is available
    const mlAvailable = await this.mlIntegrationService.isMLServiceAvailable();
    
    if (mlAvailable && alertData.eventId) {
      try {
        // Get business impact from ML
        const impactResult = await this.mlIntegrationService.calculateBusinessImpact(
          { severity: 'critical' }, // You can pass the actual event
          alertData.rootCauseAssetId ? 1 : 3, // Estimate tier
          0, // related events count
        );

        if (impactResult) {
          alert.businessImpactScore = impactResult.business_impact_score;
          alert.affectedUsers = impactResult.affected_users;
          alert.revenueAtRisk = impactResult.revenue_at_risk;
        }
      } catch (error) {
        console.log('ML enhancement failed, creating alert without ML data');
      }
    }

    return await this.alertsRepository.save(alert);
  }

  async findAll(filters?: {
    status?: AlertStatus;
    owner?: string;
    team?: string;
    slaBreached?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Alert[]; total: number }> {
    const queryBuilder = this.alertsRepository.createQueryBuilder('alert');

    if (filters?.status) {
      queryBuilder.andWhere('alert.status = :status', { status: filters.status });
    }
    if (filters?.owner) {
      queryBuilder.andWhere('alert.owner = :owner', { owner: filters.owner });
    }
    if (filters?.team) {
      queryBuilder.andWhere('alert.team = :team', { team: filters.team });
    }
    if (filters?.slaBreached !== undefined) {
      queryBuilder.andWhere('alert.slaBreached = :slaBreached', {
        slaBreached: filters.slaBreached,
      });
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    queryBuilder.take(limit).skip(offset);

    queryBuilder.orderBy('alert.slaBreached', 'DESC');
    queryBuilder.addOrderBy('alert.createdAt', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertsRepository.findOne({
      where: { id },
      relations: ['event', 'rootCauseAsset'],
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }

  async acknowledge(id: string, owner: string): Promise<Alert> {
    const alert = await this.findOne(id);

    if (alert.status !== AlertStatus.OPEN) {
      throw new Error(`Alert must be in OPEN status to acknowledge`);
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.owner = owner;
    alert.acknowledgedAt = new Date();

    return await this.alertsRepository.save(alert);
  }

  async resolve(
    id: string,
    resolutionData: {
      resolutionNotes?: string;
      resolutionCategory?: string;
    },
  ): Promise<Alert> {
    const alert = await this.findOne(id);

    if (alert.status === AlertStatus.CLOSED) {
      throw new Error(`Cannot resolve a closed alert`);
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = resolutionData.resolutionNotes;
    alert.resolutionCategory = resolutionData.resolutionCategory;

    return await this.alertsRepository.save(alert);
  }

  async close(id: string): Promise<Alert> {
    const alert = await this.findOne(id);

    if (alert.status !== AlertStatus.RESOLVED) {
      throw new Error(`Alert must be RESOLVED before closing`);
    }

    alert.status = AlertStatus.CLOSED;
    alert.closedAt = new Date();

    return await this.alertsRepository.save(alert);
  }

  async updateBusinessImpact(
    id: string,
    impactData: {
      businessImpactScore: number;
      affectedUsers?: number;
      revenueAtRisk?: number;
    },
  ): Promise<Alert> {
    const alert = await this.findOne(id);

    alert.businessImpactScore = impactData.businessImpactScore;
    alert.affectedUsers = impactData.affectedUsers;
    alert.revenueAtRisk = impactData.revenueAtRisk;

    return await this.alertsRepository.save(alert);
  }
}