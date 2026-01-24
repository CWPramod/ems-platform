// Thresholds Service (Simplified)
// Threshold rules and breach detection
// apps/api/src/masters/thresholds/thresholds.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThresholdRule } from '../../entities/threshold-rule.entity';

interface CreateThresholdDto {
  ruleName: string;
  kpiCode: string;
  assetId?: string;
  customerId?: number;
  locationId?: number;
  deviceCategory?: string;
  deviceGroupId?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  operator: string;
  durationSeconds?: number;
  consecutiveBreaches?: number;
  severity?: string;
  alertEnabled?: boolean;
  notificationEnabled?: boolean;
  description?: string;
}

@Injectable()
export class ThresholdsService {
  constructor(
    @InjectRepository(ThresholdRule)
    private thresholdRepo: Repository<ThresholdRule>,
  ) {}

  /**
   * Create a new threshold rule
   */
  async create(createThresholdDto: CreateThresholdDto, userId: number): Promise<ThresholdRule> {
    // Validate operator
    const validOperators = ['>', '>=', '<', '<=', '==', '!='];
    if (!validOperators.includes(createThresholdDto.operator)) {
      throw new BadRequestException('Invalid operator');
    }

    // Validate thresholds
    if (
      createThresholdDto.warningThreshold &&
      createThresholdDto.criticalThreshold &&
      (createThresholdDto.operator === '>' || createThresholdDto.operator === '>=')
    ) {
      if (createThresholdDto.warningThreshold >= createThresholdDto.criticalThreshold) {
        throw new BadRequestException(
          'Warning threshold must be less than critical threshold for > operator'
        );
      }
    }

    const threshold = this.thresholdRepo.create({
      ...createThresholdDto,
      severity: createThresholdDto.severity || 'warning',
      durationSeconds: createThresholdDto.durationSeconds || 300,
      consecutiveBreaches: createThresholdDto.consecutiveBreaches || 3,
      alertEnabled: createThresholdDto.alertEnabled !== false,
      notificationEnabled: createThresholdDto.notificationEnabled !== false,
      isActive: true,
      createdBy: userId,
    });

    return this.thresholdRepo.save(threshold);
  }

  /**
   * Get all threshold rules with filters
   */
  async findAll(filters?: {
    kpiCode?: string;
    assetId?: string;
    customerId?: number;
    isActive?: boolean;
    severity?: string;
  }): Promise<ThresholdRule[]> {
    const query = this.thresholdRepo.createQueryBuilder('t');

    if (filters?.kpiCode) {
      query.andWhere('t.kpi_code = :kpiCode', { kpiCode: filters.kpiCode });
    }

    if (filters?.assetId) {
      query.andWhere('t.asset_id = :assetId', { assetId: filters.assetId });
    }

    if (filters?.customerId) {
      query.andWhere('t.customer_id = :customerId', { customerId: filters.customerId });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('t.is_active = :active', { active: filters.isActive });
    }

    if (filters?.severity) {
      query.andWhere('t.severity = :severity', { severity: filters.severity });
    }

    query.orderBy('t.rule_name', 'ASC');

    return query.getMany();
  }

  /**
   * Get threshold rule by ID
   */
  async findOne(id: number): Promise<ThresholdRule> {
    const threshold = await this.thresholdRepo.findOne({
      where: { id },
    });

    if (!threshold) {
      throw new NotFoundException('Threshold rule not found');
    }

    return threshold;
  }

  /**
   * Update threshold rule
   */
  async update(
    id: number,
    updateThresholdDto: Partial<CreateThresholdDto>,
    userId: number
  ): Promise<ThresholdRule> {
    const threshold = await this.findOne(id);

    // Validate operator if being updated
    if (updateThresholdDto.operator) {
      const validOperators = ['>', '>=', '<', '<=', '==', '!='];
      if (!validOperators.includes(updateThresholdDto.operator)) {
        throw new BadRequestException('Invalid operator');
      }
    }

    await this.thresholdRepo.update(id, {
      ...updateThresholdDto,
      updatedBy: userId,
    });

    return this.findOne(id);
  }

  /**
   * Delete threshold rule
   */
  async remove(id: number): Promise<void> {
    const threshold = await this.findOne(id);
    await this.thresholdRepo.delete(id);
  }

  /**
   * Get applicable thresholds for an asset
   */
  async getApplicableThresholds(assetId: string): Promise<ThresholdRule[]> {
    // Get specific asset thresholds and global thresholds separately
const assetSpecific = await this.thresholdRepo.find({
  where: { assetId, isActive: true },
});

const global = await this.thresholdRepo
  .createQueryBuilder('t')
  .where('t.asset_id IS NULL')
  .andWhere('t.is_active = :active', { active: true })
  .getMany();

return [...assetSpecific, ...global];
  }

  /**
   * Check if value breaches threshold
   */
  async checkBreach(id: number, value: number): Promise<any> {
    const threshold = await this.findOne(id);

    let breached = false;
    let breachType: string | null = null;

    // Check warning threshold
    if (threshold.warningThreshold) {
      if (this.evaluateThreshold(value, threshold.warningThreshold, threshold.operator)) {
        breached = true;
        breachType = 'warning';
      }
    }

    // Check critical threshold (overrides warning)
    if (threshold.criticalThreshold) {
      if (this.evaluateThreshold(value, threshold.criticalThreshold, threshold.operator)) {
        breached = true;
        breachType = 'critical';
      }
    }

    return {
      ruleId: threshold.id,
      ruleName: threshold.ruleName,
      kpiCode: threshold.kpiCode,
      currentValue: value,
      breached,
      breachType,
      severity: threshold.severity,
      operator: threshold.operator,
      warningThreshold: threshold.warningThreshold,
      criticalThreshold: threshold.criticalThreshold,
    };
  }

  /**
   * Get breach history for threshold
   */
  async getBreachHistory(id: number, limit: number = 100): Promise<any[]> {
    // Simplified - return empty for now
    // In production, this would query threshold_breach_history table
    return [];
  }

  /**
   * Get threshold statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.thresholdRepo.count();
    const active = await this.thresholdRepo.count({ where: { isActive: true } });
    const bySeverity = await this.thresholdRepo
      .createQueryBuilder('t')
      .select('t.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.severity')
      .getRawMany();

    return {
      total,
      active,
      bySeverity,
    };
  }

  /**
   * Evaluate threshold based on operator
   */
  private evaluateThreshold(currentValue: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>':
        return currentValue > threshold;
      case '>=':
        return currentValue >= threshold;
      case '<':
        return currentValue < threshold;
      case '<=':
        return currentValue <= threshold;
      case '==':
        return currentValue === threshold;
      case '!=':
        return currentValue !== threshold;
      default:
        return false;
    }
  }
}

export type { CreateThresholdDto };
