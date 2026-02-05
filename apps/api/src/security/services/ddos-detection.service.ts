import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DdosEvent,
  DdosAttackType,
  DdosSeverity,
  DdosStatus,
} from '../../entities/ddos-event.entity';

@Injectable()
export class DdosDetectionService {
  constructor(
    @InjectRepository(DdosEvent)
    private ddosRepo: Repository<DdosEvent>,
  ) {}

  async getEvents(filters?: {
    status?: DdosStatus;
    attackType?: DdosAttackType;
    severity?: DdosSeverity;
    limit?: number;
    offset?: number;
  }): Promise<{ data: DdosEvent[]; total: number }> {
    const qb = this.ddosRepo.createQueryBuilder('ddos');

    if (filters?.status) {
      qb.andWhere('ddos.status = :status', { status: filters.status });
    }
    if (filters?.attackType) {
      qb.andWhere('ddos.attack_type = :attackType', {
        attackType: filters.attackType,
      });
    }
    if (filters?.severity) {
      qb.andWhere('ddos.severity = :severity', { severity: filters.severity });
    }

    qb.orderBy('ddos.detected_at', 'DESC');
    const total = await qb.getCount();
    qb.take(filters?.limit || 50).skip(filters?.offset || 0);
    const data = await qb.getMany();

    return { data, total };
  }

  async getEventById(id: string): Promise<DdosEvent | null> {
    return this.ddosRepo.findOne({ where: { id } });
  }

  async getSummary(): Promise<any> {
    const total = await this.ddosRepo.count();
    const active = await this.ddosRepo.count({
      where: { status: DdosStatus.ACTIVE },
    });
    const mitigated = await this.ddosRepo.count({
      where: { status: DdosStatus.MITIGATED },
    });
    const resolved = await this.ddosRepo.count({
      where: { status: DdosStatus.RESOLVED },
    });

    // By attack type
    const byType = await this.ddosRepo
      .createQueryBuilder('ddos')
      .select('ddos.attack_type', 'attackType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ddos.attack_type')
      .getRawMany();

    // Peak bandwidth
    const peakResult = await this.ddosRepo
      .createQueryBuilder('ddos')
      .select('MAX(ddos.peak_bandwidth_gbps)', 'maxBandwidth')
      .getRawOne();

    // Average duration of resolved events
    const avgDuration = await this.ddosRepo
      .createQueryBuilder('ddos')
      .select('AVG(ddos.duration_seconds)', 'avgDuration')
      .where('ddos.status = :status', { status: DdosStatus.RESOLVED })
      .getRawOne();

    return {
      total,
      active,
      mitigated,
      resolved,
      peakBandwidthGbps: parseFloat(peakResult?.maxBandwidth || '0'),
      averageDurationSeconds: Math.round(
        parseFloat(avgDuration?.avgDuration || '0'),
      ),
      byType,
    };
  }

  async getActiveAttacks(): Promise<DdosEvent[]> {
    return this.ddosRepo.find({
      where: { status: DdosStatus.ACTIVE },
      order: { detectedAt: 'DESC' },
    });
  }

  async getDetailedReport(id: string): Promise<any> {
    const event = await this.ddosRepo.findOne({ where: { id } });
    if (!event) return null;

    const durationMinutes = Math.round(event.durationSeconds / 60);
    const totalGB = (Number(event.totalBytes) / (1024 * 1024 * 1024)).toFixed(
      2,
    );

    return {
      event,
      analysis: {
        targetDetails: {
          ip: event.targetIp,
          port: event.targetPort,
          assetName: event.targetAssetName,
          routerInterface: event.routerInterface,
          customerName: event.customerName,
          asn: event.asn,
        },
        attackProfile: {
          type: event.attackType,
          vectors: event.attackVectors,
          peakBandwidthGbps: event.peakBandwidthGbps,
          peakPps: Number(event.peakPps),
          totalPackets: Number(event.totalPackets),
          totalBytes: Number(event.totalBytes),
          totalGB,
          durationSeconds: event.durationSeconds,
          durationMinutes,
        },
        sourceAnalysis: {
          totalSources: event.sourceIps?.length || 0,
          sourceIps: event.sourceIps?.slice(0, 50) || [],
        },
        impact: {
          severity: event.severity,
          status: event.status,
          detectedAt: event.detectedAt,
          mitigatedAt: event.mitigatedAt,
          resolvedAt: event.resolvedAt,
          timeToMitigate: event.mitigatedAt
            ? Math.round(
                (new Date(event.mitigatedAt).getTime() -
                  new Date(event.detectedAt).getTime()) /
                  1000,
              )
            : null,
        },
        mitigation: {
          strategy: event.mitigationStrategy,
          initiatedBy: event.mitigationInitiatedBy,
          notes: event.mitigationNotes,
          resolvedBy: event.resolvedBy,
          resolutionNotes: event.resolutionNotes,
        },
      },
    };
  }

  async mitigateEvent(
    id: string,
    data: { strategy: string; initiatedBy: string; notes?: string },
  ): Promise<DdosEvent | null> {
    const event = await this.ddosRepo.findOne({ where: { id } });
    if (!event) return null;
    event.status = DdosStatus.MITIGATED;
    event.mitigatedAt = new Date();
    event.mitigationStrategy = data.strategy;
    event.mitigationInitiatedBy = data.initiatedBy;
    event.mitigationNotes = data.notes ?? '';
    event.durationSeconds = Math.round(
      (Date.now() - new Date(event.detectedAt).getTime()) / 1000,
    );
    return this.ddosRepo.save(event);
  }

  async resolveEvent(
    id: string,
    data: { resolvedBy: string; notes?: string },
  ): Promise<DdosEvent | null> {
    const event = await this.ddosRepo.findOne({ where: { id } });
    if (!event) return null;
    event.status = DdosStatus.RESOLVED;
    event.resolvedAt = new Date();
    event.resolvedBy = data.resolvedBy;
    event.resolutionNotes = data.notes ?? '';
    event.durationSeconds = Math.round(
      (Date.now() - new Date(event.detectedAt).getTime()) / 1000,
    );
    return this.ddosRepo.save(event);
  }
}
