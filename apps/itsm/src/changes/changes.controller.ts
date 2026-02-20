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
import { ChangesService } from './changes.service';
import { CreateChangeDto } from './dto/create-change.dto';

@ApiTags('changes')
@ApiBearerAuth()
@Controller('api/v1/itsm/changes')
@UseGuards(JwtAuthGuard)
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateChangeDto, @UserId() userId: string) {
    return this.changesService.create(dto, userId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.changesService.findAll(
      parseInt(page || '1', 10) || 1,
      Math.min(parseInt(limit || '20', 10) || 20, 100),
    );
  }

  @Get('calendar')
  async getCalendar(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.changesService.getCalendar(startDate, endDate);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.changesService.findOne(id);
  }
}
