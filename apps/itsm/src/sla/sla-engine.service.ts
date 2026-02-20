import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';
import { TicketHistory } from '../tickets/entities/ticket-history.entity';
import { SlaService } from './sla.service';
import { RedisPublisherService } from '../events/redis-publisher.service';

@Injectable()
export class SlaEngineService {
  private readonly logger = new Logger(SlaEngineService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketHistory)
    private readonly historyRepo: Repository<TicketHistory>,
    private readonly slaService: SlaService,
    private readonly redisPublisher: RedisPublisherService,
  ) {}

  @Cron('*/60 * * * * *')
  async checkSlaBreaches(): Promise<void> {
    // Find all active tickets that are not yet breached and have an SLA policy
    const tickets = await this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.slaPolicy', 'sla')
      .where('t.status NOT IN (:...statuses)', {
        statuses: ['resolved', 'closed'],
      })
      .andWhere('t.breached = FALSE')
      .andWhere('t.sla_policy_id IS NOT NULL')
      .getMany();

    for (const ticket of tickets) {
      if (!ticket.slaPolicy) continue;

      const elapsedMinutes = this.slaService.calculateElapsedMinutes(ticket);

      // Check L1 escalation
      if (
        elapsedMinutes > ticket.slaPolicy.escalationLevel1Minutes &&
        !(await this.hasEscalation(ticket.id, 'escalation_l1'))
      ) {
        await this.recordEscalation(ticket, 'escalation_l1');
        this.logger.warn(
          `L1 escalation for ticket ${ticket.ticketNumber} (${elapsedMinutes.toFixed(1)} min elapsed)`,
        );
      }

      // Check L2 escalation
      if (
        elapsedMinutes > ticket.slaPolicy.escalationLevel2Minutes &&
        !(await this.hasEscalation(ticket.id, 'escalation_l2'))
      ) {
        await this.recordEscalation(ticket, 'escalation_l2');
        this.logger.warn(
          `L2 escalation for ticket ${ticket.ticketNumber} (${elapsedMinutes.toFixed(1)} min elapsed)`,
        );
      }

      // Check breach
      if (elapsedMinutes > ticket.slaPolicy.resolutionTimeMinutes) {
        await this.ticketRepo.update(ticket.id, { breached: true });

        await this.historyRepo.save(
          this.historyRepo.create({
            ticketId: ticket.id,
            fieldChanged: 'breached',
            oldValue: 'false',
            newValue: 'true',
            changedBy: 'system',
          }),
        );

        await this.redisPublisher.publish('ticket_breached', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          severity: ticket.severity,
          elapsedMinutes: Math.round(elapsedMinutes),
        });

        this.logger.error(
          `SLA BREACHED for ticket ${ticket.ticketNumber} (${elapsedMinutes.toFixed(1)} min elapsed, limit ${ticket.slaPolicy.resolutionTimeMinutes} min)`,
        );
      }
    }
  }

  private async hasEscalation(ticketId: string, escalationType: string): Promise<boolean> {
    const count = await this.historyRepo.count({
      where: {
        ticketId,
        fieldChanged: escalationType,
      },
    });
    return count > 0;
  }

  private async recordEscalation(ticket: Ticket, escalationType: string): Promise<void> {
    await this.historyRepo.save(
      this.historyRepo.create({
        ticketId: ticket.id,
        fieldChanged: escalationType,
        oldValue: undefined,
        newValue: `Escalation triggered at ${new Date().toISOString()}`,
        changedBy: 'system',
      }),
    );

    await this.redisPublisher.publish('ticket_escalation', {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      escalationType,
      severity: ticket.severity,
    });
  }
}
