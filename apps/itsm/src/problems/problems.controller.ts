import {
  Controller,
  Get,
  Post,
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
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';

@ApiTags('problems')
@ApiBearerAuth()
@Controller('api/v1/itsm/problems')
@UseGuards(JwtAuthGuard)
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProblemDto, @UserId() userId: string) {
    return this.problemsService.create(dto, userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.problemsService.findAll(
      parseInt(page || '1', 10) || 1,
      Math.min(parseInt(limit || '20', 10) || 20, 100),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.problemsService.findOne(id);
  }
}
