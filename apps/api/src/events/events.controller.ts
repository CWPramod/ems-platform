import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { Event } from '../entities/event.entity';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() eventData: Partial<Event>): Promise<Event> {
    return await this.eventsService.create(eventData);
  }

  @Get()
  async findAll(
    @Query('source') source?: string,
    @Query('severity') severity?: string,
    @Query('assetId') assetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: Event[]; total: number; page: number }> {
    const filters = {
      source,
      severity,
      assetId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const result = await this.eventsService.findAll(filters);

    return {
      ...result,
      page: Math.floor((filters.offset || 0) / (filters.limit || 50)),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Event | null> {
    return await this.eventsService.findOne(id);
  }
}