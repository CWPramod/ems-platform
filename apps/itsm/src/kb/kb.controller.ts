import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserId } from '../common/decorators';
import { KbService } from './kb.service';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';

@ApiTags('kb')
@ApiBearerAuth()
@Controller('api/v1/itsm/kb')
@UseGuards(JwtAuthGuard)
export class KbController {
  constructor(private readonly kbService: KbService) {}

  @Post('articles')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateKbArticleDto, @UserId() userId: string) {
    return this.kbService.create(dto, userId);
  }

  @Get('articles')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.kbService.findAll(
      parseInt(page || '1', 10) || 1,
      Math.min(parseInt(limit || '20', 10) || 20, 100),
      search,
      category,
      status,
    );
  }

  @Get('categories')
  async getCategories() {
    return this.kbService.getCategories();
  }

  @Get('suggest')
  async suggest(@Query('query') query: string) {
    return this.kbService.suggest(query || '');
  }

  @Get('articles/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.kbService.findOne(id);
  }

  @Patch('articles/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKbArticleDto,
    @UserId() userId: string,
  ) {
    return this.kbService.update(id, dto, userId);
  }
}
