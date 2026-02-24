import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { TicketHistory } from '../tickets/entities/ticket-history.entity';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { UpdateProblemStatusDto } from './dto/update-problem-status.dto';

const PROBLEM_TRANSITIONS: Record<string, string[]> = {
  open: ['investigating'],
  investigating: ['known_error', 'resolved'],
  known_error: ['resolved'],
  resolved: ['closed'],
};

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketHistory)
    private readonly historyRepo: Repository<TicketHistory>,
  ) {}

  async create(dto: CreateProblemDto, userId: string): Promise<Problem> {
    const problem = this.problemRepo.create({
      ...dto,
      status: dto.status || 'open',
      createdBy: userId,
    });
    return this.problemRepo.save(problem);
  }

  async findAll(
    page = 1,
    limit = 20,
    status?: string,
    search?: string,
  ): Promise<{ data: Problem[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const qb = this.problemRepo.createQueryBuilder('p');

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }
    if (search) {
      qb.andWhere(
        '(p.title ILIKE :search OR p.description ILIKE :search OR p.root_cause ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('p.created_at', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Problem> {
    const problem = await this.problemRepo.findOne({ where: { id } });
    if (!problem) throw new NotFoundException(`Problem with ID ${id} not found`);
    return problem;
  }

  async update(id: string, dto: UpdateProblemDto, userId: string): Promise<Problem> {
    const problem = await this.findOne(id);
    Object.assign(problem, dto);
    return this.problemRepo.save(problem);
  }

  async updateStatus(id: string, dto: UpdateProblemStatusDto, userId: string): Promise<Problem> {
    const problem = await this.findOne(id);
    const oldStatus = problem.status;
    const newStatus = dto.status;

    const allowed = PROBLEM_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transition from '${oldStatus}' to '${newStatus}' is not allowed`,
      );
    }

    if (newStatus === 'resolved' && !problem.rootCause) {
      throw new BadRequestException('Root cause is required before resolving a problem');
    }

    problem.status = newStatus;
    const saved = await this.problemRepo.save(problem);
    this.logger.log(`Problem ${id} status: ${oldStatus} → ${newStatus}`);
    return saved;
  }

  async linkIncident(problemId: string, ticketId: string, userId: string): Promise<Ticket> {
    await this.findOne(problemId);
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException(`Ticket with ID ${ticketId} not found`);

    const oldProblemId = ticket.problemId || '';
    ticket.problemId = problemId;
    const saved = await this.ticketRepo.save(ticket);

    // Record in ticket history
    const entry = this.historyRepo.create({
      ticketId,
      fieldChanged: 'problem_id',
      oldValue: oldProblemId,
      newValue: problemId,
      changedBy: userId,
    });
    await this.historyRepo.save(entry);

    this.logger.log(`Ticket ${ticket.ticketNumber} linked to problem ${problemId}`);
    return saved;
  }

  async getLinkedIncidents(problemId: string): Promise<Ticket[]> {
    await this.findOne(problemId);
    return this.ticketRepo.find({
      where: { problemId },
      relations: ['slaPolicy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getKnownErrors(
    page = 1,
    limit = 20,
  ): Promise<{ data: Problem[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.problemRepo.findAndCount({
      where: { status: 'known_error' },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async suggest(query: string): Promise<Problem[]> {
    return this.problemRepo
      .createQueryBuilder('p')
      .where('p.status IN (:...statuses)', { statuses: ['known_error', 'investigating'] })
      .andWhere(
        '(p.title ILIKE :query OR p.root_cause ILIKE :query OR p.description ILIKE :query)',
        { query: `%${query}%` },
      )
      .orderBy('p.updated_at', 'DESC')
      .take(5)
      .getMany();
  }
}
