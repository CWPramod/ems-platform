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
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { UpdateProblemStatusDto } from './dto/update-problem-status.dto';
import { LinkIncidentDto } from './dto/link-incident.dto';

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
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.problemsService.findAll(
      parseInt(page || '1', 10) || 1,
      Math.min(parseInt(limit || '20', 10) || 20, 100),
      status,
      search,
    );
  }

  @Get('known-errors')
  async getKnownErrors(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.problemsService.getKnownErrors(
      parseInt(page || '1', 10) || 1,
      Math.min(parseInt(limit || '20', 10) || 20, 100),
    );
  }

  @Get('suggest')
  async suggest(@Query('query') query: string) {
    return this.problemsService.suggest(query || '');
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.problemsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
    @UserId() userId: string,
  ) {
    return this.problemsService.update(id, dto, userId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemStatusDto,
    @UserId() userId: string,
  ) {
    return this.problemsService.updateStatus(id, dto, userId);
  }

  @Post(':id/incidents')
  @HttpCode(HttpStatus.OK)
  async linkIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkIncidentDto,
    @UserId() userId: string,
  ) {
    return this.problemsService.linkIncident(id, dto.ticketId, userId);
  }

  @Get(':id/incidents')
  async getLinkedIncidents(@Param('id', ParseUUIDPipe) id: string) {
    return this.problemsService.getLinkedIncidents(id);
  }
}
