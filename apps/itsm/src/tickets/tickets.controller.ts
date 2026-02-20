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
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { CreateLinkDto } from './dto/create-link.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('api/v1/itsm/tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTicketDto, @UserId() userId: string) {
    return this.ticketsService.create(dto, userId);
  }

  @Get()
  async findAll(@Query() query: TicketQueryDto) {
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @UserId() userId: string,
  ) {
    return this.ticketsService.updateStatus(id, dto, userId);
  }

  @Patch(':id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @UserId() userId: string,
  ) {
    return this.ticketsService.assign(id, dto, userId);
  }

  @Get(':id/history')
  async getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.getHistory(id);
  }

  @Post(':id/links')
  @HttpCode(HttpStatus.CREATED)
  async createLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLinkDto,
    @UserId() userId: string,
  ) {
    return this.ticketsService.createLink(id, dto, userId);
  }
}
