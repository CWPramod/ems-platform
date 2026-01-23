// Threshold Service
// Manages KPI threshold rules and breach detection
// apps/api/src/masters/thresholds/thresholds.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface ThresholdRule {
  id: number;
  rule_name: string;
  kpi_code: string;
  asset_id?: number;
  customer_id?: number;
  location_id?: number;
  device_category?: string;
  device_group_id?: number;
  warning_threshold: number;
  critical_threshold: number;
  operator: string;
  duration_seconds: number;
  consecutive_breaches: number;
  severity: string;
  alert_enabled: boolean;
  notification_enabled: boolean;
  notification_channels?: any;
  notification_recipients?: string[];
  auto_remediate: boolean;
  remediation_action?: string;
  remediation_script?: string;
  active_hours?: string;
  active_days?: string[];
  exclude_maintenance_windows: boolean;
  is_active: boolean;
  last_triggered?: Date;
  trigger_count: number;
  description?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

interface CreateThresholdDto {
  rule_name: string;
  kpi_code: string;
  asset_id?: number;
  customer_id?: number;
  location_id?: number;
  device_category?: string;
  device_group_id?: number;
  warning_threshold?: number;
  critical_threshold?: number;
  operator: string;
  duration_seconds?: number;
  consecutive_breaches?: number;
  severity?: string;
  alert_enabled?: boolean;
  notification_enabled?: boolean;
  notification_channels?: any;
  notification_recipients?: string[];
  auto_remediate?: boolean;
  remediation_action?: string;
  remediation_script?: string;
  active_hours?: string;
  active_days?: string[];
  description?: string;
  tags?: string[];
}

@Injectable()
export class ThresholdsService {
  constructor(
    @InjectRepository('ThresholdRule')
    private thresholdRepo: Repository<ThresholdRule>,
    @InjectRepository('KpiDefinition')
    private kpiRepo: Repository<any>,
  ) {}

  /**
   * Create threshold rule
   */
  async create(createDto: CreateThresholdDto, userId: number): Promise<ThresholdRule> {
    // Validate KPI code exists
    const kpi = await this.kpiRepo.findOne({
      where: { kpi_code: createDto.kpi_code },
    });

    if (!kpi) {
      throw new BadRequestException('Invalid KPI code');
    }

    // Validate thresholds
    if (createDto.warning_threshold && createDto.critical_threshold) {
      if (createDto.operator === '>') {
        if (createDto.warning_threshold >= createDto.critical_threshold) {
          throw new BadRequestException('Warning threshold must be less than critical threshold for > operator');
        }
      } else if (createDto.operator === '<') {
        if (createDto.warning_threshold <= createDto.critical_threshold) {
          throw new BadRequestException('Warning threshold must be greater than critical threshold for < operator');
        }
      }
    }

    const threshold = await this.thresholdRepo.save({
      ...createDto,
      duration_seconds: createDto.duration_seconds || 300,
      consecutive_breaches: createDto.consecutive_breaches || 3,
      severity: createDto.severity || 'warning',
      alert_enabled: createDto.alert_enabled !== false,
      notification_enabled: createDto.notification_enabled !== false,
      auto_remediate: createDto.auto_remediate || false,
      exclude_maintenance_windows: true,
      is_active: true,
      trigger_count: 0,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return threshold;
  }

  /**
   * Get all threshold rules
   */
  async findAll(filters?: {
    kpi_code?: string;
    asset_id?: number;
    customer_id?: number;
    is_active?: boolean;
    severity?: string;
  }): Promise<ThresholdRule[]> {
    const query = this.thresholdRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.kpi_definition', 'kpi')
      .leftJoinAndSelect('t.asset', 'a')
      .leftJoinAndSelect('t.customer', 'c');

    if (filters?.kpi_code) {
      query.andWhere('t.kpi_code = :kpiCode', { kpiCode: filters.kpi_code });
    }

    if (filters?.asset_id) {
      query.andWhere('t.asset_id = :assetId', { assetId: filters.asset_id });
    }

    if (filters?.customer_id) {
      query.andWhere('t.customer_id = :customerId', { customerId: filters.customer_id });
    }

    if (filters?.is_active !== undefined) {
      query.andWhere('t.is_active = :active', { active: filters.is_active });
    }

    if (filters?.severity) {
      query.andWhere('t.severity = :severity', { severity: filters.severity });
    }

    query.orderBy('t.created_at', 'DESC');

    return query.getMany();
  }

  /**
   * Get threshold rule by ID
   */
  async findOne(id: number): Promise<ThresholdRule> {
    const threshold = await this.thresholdRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.kpi_definition', 'kpi')
      .leftJoinAndSelect('t.asset', 'a')
      .leftJoinAndSelect('t.customer', 'c')
      .where('t.id = :id', { id })
      .getOne();

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
    updateDto: Partial<CreateThresholdDto>,
    userId: number
  ): Promise<ThresholdRule> {
    const threshold = await this.findOne(id);

    // Validate KPI if changed
    if (updateDto.kpi_code && updateDto.kpi_code !== threshold.kpi_code) {
      const kpi = await this.kpiRepo.findOne({
        where: { kpi_code: updateDto.kpi_code },
      });

      if (!kpi) {
        throw new BadRequestException('Invalid KPI code');
      }
    }

    await this.thresholdRepo.update(id, {
      ...updateDto,
      updated_by: userId,
      updated_at: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * Delete threshold rule
   */
  async remove(id: number): Promise<void> {
    const threshold = await this.findOne(id);
    
    // Soft delete by marking inactive
    await this.thresholdRepo.update(id, {
      is_active: false,
      updated_at: new Date(),
    });
  }

  /**
   * Get applicable thresholds for a device and KPI
   */
  async getApplicableThresholds(assetId: number, kpiCode: string): Promise<ThresholdRule[]> {
    const result = await this.thresholdRepo.query(
      'SELECT * FROM get_applicable_thresholds($1, $2)',
      [assetId, kpiCode]
    );

    return result;
  }

  /**
   * Check if value breaches threshold
   */
  async checkBreach(assetId: number, kpiCode: string, currentValue: number): Promise<any> {
    const result = await this.thresholdRepo.query(
      'SELECT * FROM check_threshold_breach($1, $2, $3)',
      [assetId, kpiCode, currentValue]
    );

    return result;
  }

  /**
   * Get threshold breach history
   */
  async getBreachHistory(filters?: {
    asset_id?: number;
    kpi_code?: string;
    is_resolved?: boolean;
    days?: number;
  }): Promise<any[]> {
    const query = this.thresholdRepo
      .createQueryBuilder('tbh')
      .select('*')
      .from('threshold_breach_history', 'tbh')
      .leftJoin('threshold_rules', 'tr', 'tbh.threshold_rule_id = tr.id')
      .leftJoin('assets', 'a', 'tbh.asset_id = a.id');

    if (filters?.asset_id) {
      query.andWhere('tbh.asset_id = :assetId', { assetId: filters.asset_id });
    }

    if (filters?.kpi_code) {
      query.andWhere('tbh.kpi_code = :kpiCode', { kpiCode: filters.kpi_code });
    }

    if (filters?.is_resolved !== undefined) {
      query.andWhere('tbh.is_resolved = :resolved', { resolved: filters.is_resolved });
    }

    if (filters?.days) {
      query.andWhere('tbh.breach_started_at > NOW() - INTERVAL :days DAY', { days: filters.days });
    }

    query.orderBy('tbh.breach_started_at', 'DESC');

    return query.getRawMany();
  }

  /**
   * Get threshold statistics
   */
  async getStatistics(): Promise<any> {
    const total = await this.thresholdRepo.count({ where: { is_active: true } });
    const bySeverity = await this.thresholdRepo
      .createQueryBuilder('t')
      .select('t.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('t.is_active = true')
      .groupBy('t.severity')
      .getRawMany();

    const byKpi = await this.thresholdRepo
      .createQueryBuilder('t')
      .select('t.kpi_code', 'kpi_code')
      .addSelect('COUNT(*)', 'count')
      .where('t.is_active = true')
      .groupBy('t.kpi_code')
      .getRawMany();

    return {
      total,
      by_severity: bySeverity,
      by_kpi: byKpi,
    };
  }

  /**
   * Test threshold rule (dry run)
   */
  async testRule(ruleId: number, testValue: number): Promise<any> {
    const rule = await this.findOne(ruleId);
    
    let breachType = 'normal';
    
    // Check critical threshold
    if (rule.critical_threshold !== null) {
      if (this.evaluateCondition(testValue, rule.operator, rule.critical_threshold)) {
        breachType = 'critical';
      }
    }
    
    // Check warning threshold
    if (breachType === 'normal' && rule.warning_threshold !== null) {
      if (this.evaluateCondition(testValue, rule.operator, rule.warning_threshold)) {
        breachType = 'warning';
      }
    }

    return {
      rule_name: rule.rule_name,
      kpi_code: rule.kpi_code,
      test_value: testValue,
      warning_threshold: rule.warning_threshold,
      critical_threshold: rule.critical_threshold,
      operator: rule.operator,
      result: breachType,
      would_alert: breachType !== 'normal' && rule.alert_enabled,
      would_notify: breachType !== 'normal' && rule.notification_enabled,
    };
  }

  // Helper method to evaluate condition
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }
}

export { ThresholdRule, CreateThresholdDto };
