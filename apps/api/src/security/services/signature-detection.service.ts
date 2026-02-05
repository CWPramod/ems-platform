import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SignatureAlert,
  SignatureAlertStatus,
  SignatureCategory,
  SignatureSeverity,
} from '../../entities/signature-alert.entity';
import { In } from 'typeorm';

@Injectable()
export class SignatureDetectionService {
  constructor(
    @InjectRepository(SignatureAlert)
    private sigRepo: Repository<SignatureAlert>,
  ) {}

  async getAlerts(filters?: {
    category?: SignatureCategory;
    severity?: SignatureSeverity;
    status?: SignatureAlertStatus;
    sourceIp?: string;
    destinationIp?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SignatureAlert[]; total: number }> {
    const qb = this.sigRepo.createQueryBuilder('sig');

    if (filters?.category) {
      qb.andWhere('sig.category = :category', { category: filters.category });
    }
    if (filters?.severity) {
      qb.andWhere('sig.severity = :severity', { severity: filters.severity });
    }
    if (filters?.status) {
      qb.andWhere('sig.status = :status', { status: filters.status });
    }
    if (filters?.sourceIp) {
      qb.andWhere('sig.source_ip = :sourceIp', { sourceIp: filters.sourceIp });
    }
    if (filters?.destinationIp) {
      qb.andWhere('sig.destination_ip = :destIp', {
        destIp: filters.destinationIp,
      });
    }

    qb.orderBy('sig.timestamp', 'DESC');
    const total = await qb.getCount();
    qb.take(filters?.limit || 50).skip(filters?.offset || 0);
    const data = await qb.getMany();

    return { data, total };
  }

  async getAlertById(id: string): Promise<SignatureAlert | null> {
    return this.sigRepo.findOne({ where: { id } });
  }

  async getSummary(): Promise<any> {
    const total = await this.sigRepo.count();

    // Count by severity
    const bySeverity = await this.sigRepo
      .createQueryBuilder('sig')
      .select('sig.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sig.severity')
      .getRawMany();

    // Count by category
    const byCategory = await this.sigRepo
      .createQueryBuilder('sig')
      .select('sig.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sig.category')
      .getRawMany();

    // Last 24h count
    const oneDayAgo = new Date(Date.now() - 86400000);
    const last24h = await this.sigRepo
      .createQueryBuilder('sig')
      .where('sig.timestamp >= :since', { since: oneDayAgo })
      .getCount();

    // Critical in last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const criticalLastHour = await this.sigRepo
      .createQueryBuilder('sig')
      .where('sig.severity = :sev', { sev: SignatureSeverity.CRITICAL })
      .andWhere('sig.timestamp >= :since', { since: oneHourAgo })
      .getCount();

    return {
      total,
      last24h,
      criticalLastHour,
      bySeverity,
      byCategory,
    };
  }

  async getPacketDrilldown(id: string): Promise<any> {
    const alert = await this.sigRepo.findOne({ where: { id } });
    if (!alert || !alert.packetPayload) {
      return null;
    }

    // Decode base64 payload to hex dump + ASCII
    const raw = Buffer.from(alert.packetPayload, 'base64');
    const hexLines: string[] = [];

    for (let i = 0; i < raw.length; i += 16) {
      const slice = raw.slice(i, Math.min(i + 16, raw.length));
      const hex = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(slice)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      const offset = i.toString(16).padStart(8, '0');
      hexLines.push(`${offset}  ${hex.padEnd(48)}  |${ascii}|`);
    }

    return {
      alertId: alert.id,
      signatureId: alert.signatureId,
      signatureName: alert.signatureName,
      packetLength: alert.packetLength,
      hexDump: hexLines.join('\n'),
      rawBase64: alert.packetPayload,
    };
  }

  async acknowledgeAlert(id: string, by: string): Promise<SignatureAlert | null> {
    const alert = await this.sigRepo.findOne({ where: { id } });
    if (!alert) return null;
    alert.status = SignatureAlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = by;
    alert.acknowledgedAt = new Date();
    return this.sigRepo.save(alert);
  }

  async dismissAlert(id: string, by: string): Promise<SignatureAlert | null> {
    const alert = await this.sigRepo.findOne({ where: { id } });
    if (!alert) return null;
    alert.status = SignatureAlertStatus.DISMISSED;
    alert.dismissedBy = by;
    alert.dismissedAt = new Date();
    return this.sigRepo.save(alert);
  }

  async escalateAlert(id: string, by: string, notes?: string): Promise<SignatureAlert | null> {
    const alert = await this.sigRepo.findOne({ where: { id } });
    if (!alert) return null;
    alert.status = SignatureAlertStatus.ESCALATED;
    alert.escalatedBy = by;
    alert.escalatedAt = new Date();
    alert.escalationNotes = notes ?? '';
    return this.sigRepo.save(alert);
  }

  async bulkUpdateStatus(
    ids: string[],
    action: 'acknowledge' | 'dismiss' | 'escalate',
    by: string,
    notes?: string,
  ): Promise<{ updated: number }> {
    const alerts = await this.sigRepo.find({ where: { id: In(ids) } });
    const now = new Date();
    let updated = 0;

    for (const alert of alerts) {
      switch (action) {
        case 'acknowledge':
          alert.status = SignatureAlertStatus.ACKNOWLEDGED;
          alert.acknowledgedBy = by;
          alert.acknowledgedAt = now;
          break;
        case 'dismiss':
          alert.status = SignatureAlertStatus.DISMISSED;
          alert.dismissedBy = by;
          alert.dismissedAt = now;
          break;
        case 'escalate':
          alert.status = SignatureAlertStatus.ESCALATED;
          alert.escalatedBy = by;
          alert.escalatedAt = now;
          alert.escalationNotes = notes ?? '';
          break;
      }
      await this.sigRepo.save(alert);
      updated++;
    }

    return { updated };
  }
}
