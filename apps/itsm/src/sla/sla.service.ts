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
    // Total closed/resolved tickets for MTTR/MTTA
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
}
