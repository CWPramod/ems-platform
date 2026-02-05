import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IocEntry,
  IocType,
  IocSeverity,
  IocStatus,
} from '../../entities/ioc-entry.entity';

@Injectable()
export class IocMonitoringService {
  constructor(
    @InjectRepository(IocEntry)
    private iocRepo: Repository<IocEntry>,
  ) {}

  async getEntries(filters?: {
    type?: IocType;
    severity?: IocSeverity;
    status?: IocStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: IocEntry[]; total: number }> {
    const qb = this.iocRepo.createQueryBuilder('ioc');

    if (filters?.type) {
      qb.andWhere('ioc.type = :type', { type: filters.type });
    }
    if (filters?.severity) {
      qb.andWhere('ioc.severity = :severity', { severity: filters.severity });
    }
    if (filters?.status) {
      qb.andWhere('ioc.status = :status', { status: filters.status });
    }

    qb.orderBy('ioc.created_at', 'DESC');
    const total = await qb.getCount();
    qb.take(filters?.limit || 50).skip(filters?.offset || 0);
    const data = await qb.getMany();

    return { data, total };
  }

  async getEntryById(id: string): Promise<IocEntry | null> {
    return this.iocRepo.findOne({ where: { id } });
  }

  async getSummary(): Promise<any> {
    const total = await this.iocRepo.count();
    const active = await this.iocRepo.count({
      where: { status: IocStatus.ACTIVE },
    });
    const matched = await this.iocRepo.count({
      where: { status: IocStatus.MATCHED },
    });
    const expired = await this.iocRepo.count({
      where: { status: IocStatus.EXPIRED },
    });
    const falsePositive = await this.iocRepo.count({
      where: { status: IocStatus.FALSE_POSITIVE },
    });

    // Count by type
    const byType = await this.iocRepo
      .createQueryBuilder('ioc')
      .select('ioc.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ioc.type')
      .getRawMany();

    // Count by severity
    const bySeverity = await this.iocRepo
      .createQueryBuilder('ioc')
      .select('ioc.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ioc.severity')
      .getRawMany();

    // Total matches
    const matchResult = await this.iocRepo
      .createQueryBuilder('ioc')
      .select('SUM(ioc.match_count)', 'totalMatches')
      .getRawOne();

    return {
      total,
      active,
      matched,
      expired,
      falsePositive,
      totalMatches: parseInt(matchResult?.totalMatches || '0'),
      byType,
      bySeverity,
    };
  }

  async getRecentMatches(limit: number = 20): Promise<IocEntry[]> {
    return this.iocRepo.find({
      where: { status: IocStatus.MATCHED },
      order: { lastMatchedAt: 'DESC' },
      take: limit,
    });
  }

  async createEntry(data: {
    type: IocType;
    indicator: string;
    source: string;
    severity?: IocSeverity;
    threatType?: string;
    description?: string;
  }): Promise<IocEntry> {
    const entry = this.iocRepo.create({
      ...data,
      status: IocStatus.ACTIVE,
      matchCount: 0,
      expiresAt: new Date(Date.now() + 90 * 86400000),
    });
    return this.iocRepo.save(entry);
  }

  async importCsv(csvContent: string): Promise<{ imported: number; errors: number }> {
    const lines = csvContent.trim().split('\n');
    // Skip header if present
    const start = lines[0]?.toLowerCase().includes('type') ? 1 : 0;
    let imported = 0;
    let errors = 0;

    for (let i = start; i < lines.length; i++) {
      try {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (cols.length < 3) {
          errors++;
          continue;
        }
        const [type, indicator, source, severity, threatType, description] = cols;
        const validTypes = Object.values(IocType) as string[];
        if (!validTypes.includes(type)) {
          errors++;
          continue;
        }
        const entry = this.iocRepo.create({
          type: type as IocType,
          indicator,
          source: source || 'CSV Import',
          severity: (Object.values(IocSeverity) as string[]).includes(severity)
            ? (severity as IocSeverity)
            : IocSeverity.MEDIUM,
          status: IocStatus.ACTIVE,
          threatType: threatType || undefined,
          description: description || undefined,
          matchCount: 0,
          expiresAt: new Date(Date.now() + 90 * 86400000),
        });
        await this.iocRepo.save(entry);
        imported++;
      } catch {
        errors++;
      }
    }

    return { imported, errors };
  }

  async updateStatus(id: string, status: IocStatus): Promise<IocEntry | null> {
    const entry = await this.iocRepo.findOne({ where: { id } });
    if (!entry) return null;
    entry.status = status;
    return this.iocRepo.save(entry);
  }
}
