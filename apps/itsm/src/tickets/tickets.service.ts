import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketHistory } from './entities/ticket-history.entity';
import { TicketLink } from './entities/ticket-link.entity';
import { TicketNumberGenerator } from '../common/utils/ticket-number.generator';
import { SlaService } from '../sla/sla.service';
import { RedisPublisherService } from '../events/redis-publisher.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { CreateLinkDto } from './dto/create-link.dto';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ['acknowledged', 'in_progress'],
  acknowledged: ['in_progress'],
  in_progress: ['pending', 'resolved'],
  pending: ['in_progress'],
  resolved: ['closed', 'in_progress'],
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketHistory)
    private readonly historyRepo: Repository<TicketHistory>,
    @InjectRepository(TicketLink)
    private readonly linkRepo: Repository<TicketLink>,
    private readonly ticketNumberGen: TicketNumberGenerator,
    private readonly slaService: SlaService,
    private readonly redisPublisher: RedisPublisherService,
  ) {}

  async create(dto: CreateTicketDto, userId: string): Promise<Ticket> {
    const ticketNumber = await this.ticketNumberGen.generate(dto.type);

    const ticket = this.ticketRepo.create({
      ticketNumber,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      severity: dto.severity,
      priority: dto.priority,
      status: 'open',
      assetId: dto.assetId,
      alertId: dto.alertId,
      assignedTo: dto.assignedTo,
      createdBy: userId,
      source: dto.source || 'manual',
    });

    const saved = await this.ticketRepo.save(ticket);

    // Assign SLA policy based on severity
    await this.slaService.assignSlaPolicy(saved);

    // Re-fetch with SLA fields populated
    const result = await this.ticketRepo.findOne({ where: { id: saved.id }, relations: ['slaPolicy'] });

    if (result) {
      await this.redisPublisher.publish('ticket_created', {
        ticketId: result.id,
        ticketNumber: result.ticketNumber,
        severity: result.severity,
        type: result.type,
      });

      this.logger.log(`Ticket created: ${result.ticketNumber}`);
    }

    return result!;
  }

  async findAll(query: TicketQueryDto): Promise<{ data: Ticket[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.slaPolicy', 'slaPolicy');

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }
    if (query.severity) {
      qb.andWhere('ticket.severity = :severity', { severity: query.severity });
    }
    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }
    if (query.type) {
      qb.andWhere('ticket.type = :type', { type: query.type });
    }
    if (query.assignedTo) {
      qb.andWhere('ticket.assigned_to = :assignedTo', { assignedTo: query.assignedTo });
    }
    if (query.search) {
      qb.andWhere(
        '(ticket.title ILIKE :search OR ticket.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.slaBreach === 'true') {
      qb.andWhere('ticket.breached = TRUE');
    }

    // Sort
    if (query.sort) {
      const [field, direction] = query.sort.split(':');
      const allowedFields: Record<string, string> = {
        created_at: 'ticket.createdAt',
        updated_at: 'ticket.updatedAt',
        sla_due_at: 'ticket.slaDueAt',
        severity: 'ticket.severity',
        priority: 'ticket.priority',
        status: 'ticket.status',
      };
      const sortField = allowedFields[field];
      if (sortField) {
        qb.orderBy(sortField, direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
      } else {
        qb.orderBy('ticket.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('ticket.createdAt', 'DESC');
    }

    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['slaPolicy'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async findByAlertId(alertId: string): Promise<Ticket | null> {
    return this.ticketRepo.findOne({
      where: { alertId },
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto, userId: string): Promise<Ticket> {
    const ticket = await this.findOne(id);
    const oldStatus = ticket.status;
    const newStatus = dto.status;

    // Validate state machine
    const allowed = ALLOWED_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transition from '${oldStatus}' to '${newStatus}' is not allowed`,
      );
    }

    // Resolved requires resolution notes
    if (newStatus === 'resolved') {
      const notes = dto.resolutionNotes || ticket.resolutionNotes;
      if (!notes) {
        throw new BadRequestException(
          'Resolution notes are required when transitioning to resolved',
        );
      }
      ticket.resolutionNotes = notes;
    }

    // SLA pause/resume
    if (newStatus === 'pending') {
      this.slaService.pauseSla(ticket);
    }
    if (oldStatus === 'pending' && newStatus === 'in_progress') {
      this.slaService.resumeSla(ticket);
    }

    ticket.status = newStatus;
    const saved = await this.ticketRepo.save(ticket);

    // Audit history
    await this.recordHistory(id, 'status', oldStatus, newStatus, userId);

    // Publish event
    const eventType = newStatus === 'resolved'
      ? 'ticket_resolved'
      : newStatus === 'closed'
        ? 'ticket_closed'
        : 'ticket_status_changed';

    await this.redisPublisher.publish(eventType, {
      ticketId: saved.id,
      ticketNumber: saved.ticketNumber,
      oldStatus,
      newStatus,
      alertId: saved.alertId,
    });

    this.logger.log(`Ticket ${saved.ticketNumber} status: ${oldStatus} → ${newStatus}`);
    return saved;
  }

  async assign(id: string, dto: AssignTicketDto, userId: string): Promise<Ticket> {
    const ticket = await this.findOne(id);
    const oldAssignee = ticket.assignedTo;
    ticket.assignedTo = dto.assignedTo;
    const saved = await this.ticketRepo.save(ticket);

    await this.recordHistory(id, 'assigned_to', oldAssignee || '', dto.assignedTo, userId);

    this.logger.log(`Ticket ${saved.ticketNumber} assigned to ${dto.assignedTo}`);
    return saved;
  }

  async getHistory(ticketId: string): Promise<TicketHistory[]> {
    // Verify ticket exists
    await this.findOne(ticketId);
    return this.historyRepo.find({
      where: { ticketId },
      order: { changedAt: 'DESC' },
    });
  }

  async createLink(ticketId: string, dto: CreateLinkDto, userId: string): Promise<TicketLink> {
    // Verify both tickets exist
    await this.findOne(ticketId);
    await this.findOne(dto.targetTicketId);

    const link = this.linkRepo.create({
      sourceTicketId: ticketId,
      targetTicketId: dto.targetTicketId,
      linkType: dto.linkType,
      createdBy: userId,
    });

    return this.linkRepo.save(link);
  }

  async recordHistory(
    ticketId: string,
    fieldChanged: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
  ): Promise<void> {
    const entry = this.historyRepo.create({
      ticketId,
      fieldChanged,
      oldValue,
      newValue,
      changedBy,
    });
    await this.historyRepo.save(entry);
  }
}
