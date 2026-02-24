import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaPolicy } from './entities/sla-policy.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(SlaPolicy)
    private readonly slaPolicyRepo: Repository<SlaPolicy>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async assignSlaPolicy(ticket: Ticket): Promise<void> {
    const policy = await this.slaPolicyRepo.findOne({
      where: { severity: ticket.severity, isDefault: true },
    });

    if (!policy) {
      this.logger.warn(`No default SLA policy found for severity: ${ticket.severity}`);
      return;
    }

    const dueAt = new Date(ticket.createdAt.getTime() + policy.resolutionTimeMinutes * 60 * 1000);

    await this.ticketRepo.update(ticket.id, {
      slaPolicyId: policy.id,
      slaDueAt: dueAt,
    });

    this.logger.log(
      `SLA policy '${policy.name}' assigned to ticket ${ticket.ticketNumber}, due at ${dueAt.toISOString()}`,
    );
  }

  pauseSla(ticket: Ticket): void {
    ticket.pendingSince = new Date();
  }

  resumeSla(ticket: Ticket): void {
    if (ticket.pendingSince) {
      const pausedMs = Date.now() - new Date(ticket.pendingSince).getTime();
      ticket.pendingDurationMs = Number(ticket.pendingDurationMs || 0) + pausedMs;
      ticket.pendingSince = null;

      // Shift sla_due_at forward by the paused duration
      if (ticket.slaDueAt) {
        ticket.slaDueAt = new Date(new Date(ticket.slaDueAt).getTime() + pausedMs);
      }
    }
  }

  calculateElapsedMinutes(ticket: Ticket): number {
    const now = Date.now();
    const createdAt = new Date(ticket.createdAt).getTime();
    const totalPendingMs = Number(ticket.pendingDurationMs || 0);

    // If currently pending, add ongoing pending time
    let currentPendingMs = 0;
    if (ticket.pendingSince) {
      currentPendingMs = now - new Date(ticket.pendingSince).getTime();
    }

    return (now - createdAt - totalPendingMs - currentPendingMs) / 60000;
  }

  async findAllPolicies(): Promise<SlaPolicy[]> {
    return this.slaPolicyRepo.find({ order: { severity: 'ASC' } });
  }

  async createPolicy(data: Partial<SlaPolicy>): Promise<SlaPolicy> {
    const policy = this.slaPolicyRepo.create(data);
    return this.slaPolicyRepo.save(policy);
  }

  async getBreachedTickets(): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { breached: true },
      relations: ['slaPolicy'],
      order: { slaDueAt: 'ASC' },
    });
  }

  async getDashboardStats(): Promise<{
    totalTickets: number;
    breachedTickets: number;
    compliancePercent: number;
    mttrMinutes: number | null;
    mttaMinutes: number | null;
  }> {
    const totalResult = await this.ticketRepo
      .createQueryBuilder('t')
      .select('COUNT(*)', 'total')
      .getRawOne();
    const totalTickets = parseInt(totalResult.total, 10);

    const breachedResult = await this.ticketRepo
      .createQueryBuilder('t')
      .select('COUNT(*)', 'breached')
      .where('t.breached = TRUE')
      .getRawOne();
    const breachedTickets = parseInt(breachedResult.breached, 10);

    const compliancePercent = totalTickets > 0
      ? ((totalTickets - breachedTickets) / totalTickets) * 100
      : 100;

    // MTTR: average time from created_at to updated_at where status = resolved or closed
    const mttrResult = await this.ticketRepo
      .createQueryBuilder('t')
      .select(
        'AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 60)',
        'mttr',
      )
      .where('t.status IN (:...statuses)', { statuses: ['resolved', 'closed'] })
      .getRawOne();
    const mttrMinutes = mttrResult.mttr ? parseFloat(mttrResult.mttr) : null;

    // MTTA: average time from created_at to first acknowledged status change
    const mttaResult = await this.ticketRepo.manager.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (h.changed_at - t.created_at)) / 60) as mtta
      FROM ticket_history h
      JOIN tickets t ON h.ticket_id = t.id
      WHERE h.field_changed = 'status' AND h.new_value = 'acknowledged'
    `);
    const mttaMinutes = mttaResult[0]?.mtta ? parseFloat(mttaResult[0].mtta) : null;

    return {
      totalTickets,
      breachedTickets,
      compliancePercent: Math.round(compliancePercent * 100) / 100,
      mttrMinutes: mttrMinutes ? Math.round(mttrMinutes * 100) / 100 : null,
      mttaMinutes: mttaMinutes ? Math.round(mttaMinutes * 100) / 100 : null,
    };
  }

  async getBreachRateBySeverity(): Promise<
    { severity: string; total: number; breached: number; breachRate: number }[]
  > {
    const results = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.severity', 'severity')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect('SUM(CASE WHEN t.breached = TRUE THEN 1 ELSE 0 END)::int', 'breached')
      .groupBy('t.severity')
      .getRawMany();

    return results.map((r) => ({
      severity: r.severity,
      total: parseInt(r.total, 10),
      breached: parseInt(r.breached, 10),
      breachRate:
        parseInt(r.total, 10) > 0
          ? Math.round((parseInt(r.breached, 10) / parseInt(r.total, 10)) * 10000) / 100
          : 0,
    }));
  }

  async getEscalationFrequency(
    days = 30,
  ): Promise<{ date: string; fieldChanged: string; count: number }[]> {
    const results = await this.ticketRepo.manager.query(
      `SELECT DATE(changed_at) as date,
              field_changed as "fieldChanged",
              COUNT(*)::int as count
       FROM ticket_history
       WHERE field_changed LIKE 'escalation%'
         AND changed_at >= NOW() - $1::int * INTERVAL '1 day'
       GROUP BY DATE(changed_at), field_changed
       ORDER BY date`,
      [days],
    );
    return results;
  }

  async getAtRiskTickets(thresholdMinutes = 30): Promise<Ticket[]> {
    return this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.slaPolicy', 'slaPolicy')
      .where('t.breached = FALSE')
      .andWhere('t.sla_due_at IS NOT NULL')
      .andWhere('t.status NOT IN (:...statuses)', { statuses: ['resolved', 'closed'] })
      .andWhere("t.sla_due_at <= NOW() + :threshold * INTERVAL '1 minute'", {
        threshold: thresholdMinutes,
      })
      .orderBy('t.sla_due_at', 'ASC')
      .getMany();
  }

  async getComplianceTrend(
    days = 30,
  ): Promise<{ date: string; total: number; breached: number; compliancePercent: number }[]> {
    const results = await this.ticketRepo.manager.query(
      `SELECT DATE(created_at) as date,
              COUNT(*)::int as total,
              SUM(CASE WHEN breached = TRUE THEN 1 ELSE 0 END)::int as breached
       FROM tickets
       WHERE created_at >= NOW() - $1::int * INTERVAL '1 day'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [days],
    );

    return results.map((r: any) => ({
      date: r.date,
      total: parseInt(r.total, 10),
      breached: parseInt(r.breached, 10),
      compliancePercent:
        parseInt(r.total, 10) > 0
          ? Math.round(((parseInt(r.total, 10) - parseInt(r.breached, 10)) / parseInt(r.total, 10)) * 10000) / 100
          : 100,
    }));
  }
}
