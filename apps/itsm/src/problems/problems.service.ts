import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { CreateProblemDto } from './dto/create-problem.dto';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
  ) {}

  async create(dto: CreateProblemDto, userId: string): Promise<Problem> {
    const problem = this.problemRepo.create({
      ...dto,
      status: dto.status || 'open',
      createdBy: userId,
    });
    return this.problemRepo.save(problem);
  }

  async findAll(page = 1, limit = 20): Promise<{ data: Problem[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.problemRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Problem> {
    const problem = await this.problemRepo.findOne({ where: { id } });
    if (!problem) throw new NotFoundException(`Problem with ID ${id} not found`);
    return problem;
  }
}
