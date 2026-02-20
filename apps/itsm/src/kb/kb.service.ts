import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbArticle } from './entities/kb-article.entity';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';

@Injectable()
export class KbService {
  constructor(
    @InjectRepository(KbArticle)
    private readonly articleRepo: Repository<KbArticle>,
  ) {}

  async create(dto: CreateKbArticleDto, userId: string): Promise<KbArticle> {
    const article = this.articleRepo.create({
      ...dto,
      status: dto.status || 'draft',
      createdBy: userId,
    });
    return this.articleRepo.save(article);
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ data: KbArticle[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const qb = this.articleRepo.createQueryBuilder('kb');

    if (search) {
      qb.where(
        '(kb.title ILIKE :search OR kb.content ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('kb.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<KbArticle> {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`KB article with ID ${id} not found`);
    return article;
  }

  async suggest(query: string): Promise<KbArticle[]> {
    return this.articleRepo
      .createQueryBuilder('kb')
      .where('kb.status = :status', { status: 'published' })
      .andWhere(
        '(kb.title ILIKE :query OR kb.content ILIKE :query)',
        { query: `%${query}%` },
      )
      .orderBy('kb.updatedAt', 'DESC')
      .take(5)
      .getMany();
  }
}
