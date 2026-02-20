import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Change } from './entities/change.entity';
import { CreateChangeDto } from './dto/create-change.dto';

@Injectable()
export class ChangesService {
  constructor(
    @InjectRepository(Change)
    private readonly changeRepo: Repository<Change>,
  ) {}

  async create(dto: CreateChangeDto, userId: string): Promise<Change> {
    const change = this.changeRepo.create({
      ...dto,
      approvalStatus: dto.approvalStatus || 'draft',
      riskLevel: dto.riskLevel || 'medium',
      createdBy: userId,
    });
    return this.changeRepo.save(change);
  }

  async findAll(page = 1, limit = 20): Promise<{ data: Change[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.changeRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Change> {
    const change = await this.changeRepo.findOne({ where: { id } });
    if (!change) throw new NotFoundException(`Change with ID ${id} not found`);
    return change;
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
