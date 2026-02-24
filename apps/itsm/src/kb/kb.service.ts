import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbArticle } from './entities/kb-article.entity';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';

const KB_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['archived', 'draft'],
  archived: ['draft'],
};

@Injectable()
export class KbService {
  private readonly logger = new Logger(KbService.name);

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
    category?: string,
    status?: string,
  ): Promise<{ data: KbArticle[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const qb = this.articleRepo.createQueryBuilder('kb');

    if (search) {
      qb.andWhere(
        '(kb.title ILIKE :search OR kb.content ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (category) {
      qb.andWhere('kb.category = :category', { category });
    }
    if (status) {
      qb.andWhere('kb.status = :status', { status });
    }

    qb.orderBy('kb.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, incrementView = true): Promise<KbArticle> {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`KB article with ID ${id} not found`);

    if (incrementView) {
      // Fire-and-forget view count increment
      this.articleRepo.increment({ id }, 'viewCount', 1).catch(() => {});
    }

    return article;
  }

  async update(id: string, dto: UpdateKbArticleDto, userId: string): Promise<KbArticle> {
    const article = await this.findOne(id, false);

    // Handle status transitions separately
    if (dto.status && dto.status !== article.status) {
      const allowed = KB_STATUS_TRANSITIONS[article.status];
      if (!allowed || !allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Status transition from '${article.status}' to '${dto.status}' is not allowed`,
        );
      }
      article.status = dto.status;
    }

    // Auto-increment version on content change
    if (dto.content && dto.content !== article.content) {
      article.version += 1;
      article.content = dto.content;
    }

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.category !== undefined) article.category = dto.category;
    if (dto.tags !== undefined) article.tags = dto.tags;

    return this.articleRepo.save(article);
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

  async getCategories(): Promise<string[]> {
    const result = await this.articleRepo
      .createQueryBuilder('kb')
      .select('DISTINCT kb.category', 'category')
      .where('kb.category IS NOT NULL')
      .getRawMany();
    return result.map((r) => r.category);
  }
}
