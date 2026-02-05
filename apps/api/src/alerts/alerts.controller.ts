import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { Alert, AlertStatus } from '../entities/alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import {
  AcknowledgeAlertDto,
  ResolveAlertDto,
  UpdateBusinessImpactDto,
} from './dto/update-alert-status.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAlertDto: CreateAlertDto): Promise<Alert> {
    return await this.alertsService.create(createAlertDto);
  }

  @Get()
  async findAll(
    @Query('status') status?: AlertStatus,
    @Query('owner') owner?: string,
    @Query('team') team?: string,
    @Query('slaBreached') slaBreached?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: Alert[]; total: number; page: number }> {
    const filters = {
      status,
      owner,
      team,
      slaBreached: slaBreached === 'true' ? true : slaBreached === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    const result = await this.alertsService.findAll(filters);

    return {
      ...result,
      page: Math.floor((filters.offset || 0) / (filters.limit || 50)),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Alert> {
    return await this.alertsService.findOne(id);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeAlertDto,
  ): Promise<Alert> {
    return await this.alertsService.acknowledge(id, dto.owner);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveAlertDto,
  ): Promise<Alert> {
    return await this.alertsService.resolve(id, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string): Promise<Alert> {
    return await this.alertsService.close(id);
  }

  @Patch(':id/business-impact')
  async updateBusinessImpact(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessImpactDto,
  ): Promise<Alert> {
    return await this.alertsService.updateBusinessImpact(id, dto);
  }
}
