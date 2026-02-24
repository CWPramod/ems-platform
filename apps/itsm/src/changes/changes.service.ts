import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Change } from './entities/change.entity';
import { CreateChangeDto } from './dto/create-change.dto';
import { UpdateChangeDto } from './dto/update-change.dto';
import { UpdateChangeStatusDto } from './dto/update-change-status.dto';
import { TicketNumberGenerator } from '../common/utils/ticket-number.generator';

const APPROVAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  approved: ['implemented'],
  rejected: ['draft'],
  implemented: ['rolled_back'],
};

@Injectable()
export class ChangesService {
  private readonly logger = new Logger(ChangesService.name);

  constructor(
    @InjectRepository(Change)
    private readonly changeRepo: Repository<Change>,
    private readonly ticketNumberGen: TicketNumberGenerator,
  ) {}

  async create(dto: CreateChangeDto, userId: string): Promise<Change> {
    const changeNumber = await this.ticketNumberGen.generate('change');
    const change = this.changeRepo.create({
      ...dto,
      changeNumber,
      approvalStatus: dto.approvalStatus || 'draft',
      riskLevel: dto.riskLevel || 'medium',
      createdBy: userId,
    });
    return this.changeRepo.save(change);
  }

  async findAll(
    page = 1,
    limit = 20,
    approvalStatus?: string,
    riskLevel?: string,
    search?: string,
  ): Promise<{ data: Change[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const qb = this.changeRepo.createQueryBuilder('c');

    if (approvalStatus) {
      qb.andWhere('c.approval_status = :approvalStatus', { approvalStatus });
    }
    if (riskLevel) {
      qb.andWhere('c.risk_level = :riskLevel', { riskLevel });
    }
    if (search) {
      qb.andWhere(
        '(c.title ILIKE :search OR c.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('c.created_at', 'DESC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Change> {
    const change = await this.changeRepo.findOne({ where: { id } });
    if (!change) throw new NotFoundException(`Change with ID ${id} not found`);
    return change;
  }

  async update(id: string, dto: UpdateChangeDto, userId: string): Promise<Change> {
    const change = await this.findOne(id);
    if (!['draft', 'pending_approval', 'rejected'].includes(change.approvalStatus)) {
      throw new BadRequestException(
        `Cannot edit a change in '${change.approvalStatus}' status`,
      );
    }
    Object.assign(change, dto);
    return this.changeRepo.save(change);
  }

  async updateApprovalStatus(id: string, dto: UpdateChangeStatusDto, userId: string): Promise<Change> {
    const change = await this.findOne(id);
    const oldStatus = change.approvalStatus;
    const newStatus = dto.approvalStatus;

    const allowed = APPROVAL_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transition from '${oldStatus}' to '${newStatus}' is not allowed`,
      );
    }

    if (newStatus === 'approved') {
      change.approvedBy = userId;
    }

    if (newStatus === 'implemented') {
      if (!change.implementationNotes && !dto.implementationNotes) {
        throw new BadRequestException('Implementation notes are required');
      }
      if (dto.rollbackPlan) {
        change.rollbackPlan = dto.rollbackPlan;
      }
      if (!change.rollbackPlan) {
        throw new BadRequestException('Rollback plan is required before implementation');
      }
      if (dto.implementationNotes) {
        change.implementationNotes = dto.implementationNotes;
      }
    }

    change.approvalStatus = newStatus;
    const saved = await this.changeRepo.save(change);
    this.logger.log(`Change ${change.changeNumber || id} status: ${oldStatus} → ${newStatus}`);
    return saved;
  }

  async checkConflicts(id: string): Promise<Change[]> {
    const change = await this.findOne(id);
    if (!change.scheduledStart || !change.scheduledEnd) {
      return [];
    }

    return this.changeRepo
      .createQueryBuilder('c')
      .where('c.id != :id', { id })
      .andWhere('c.scheduled_start IS NOT NULL')
      .andWhere('c.scheduled_end IS NOT NULL')
      .andWhere('c.approval_status IN (:...statuses)', {
        statuses: ['pending_approval', 'approved'],
      })
      .andWhere('c.scheduled_start < :end', { end: change.scheduledEnd })
      .andWhere('c.scheduled_end > :start', { start: change.scheduledStart })
      .orderBy('c.scheduled_start', 'ASC')
      .getMany();
  }

  async getCalendar(startDate?: string, endDate?: string): Promise<Change[]> {
    const qb = this.changeRepo.createQueryBuilder('c')
      .where('c.scheduled_start IS NOT NULL');

    if (startDate) {
      qb.andWhere('c.scheduled_start >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('c.scheduled_end <= :endDate', { endDate });
    }

    qb.orderBy('c.scheduled_start', 'ASC');
    return qb.getMany();
  }
}
