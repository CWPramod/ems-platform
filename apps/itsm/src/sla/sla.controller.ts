import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SlaService } from './sla.service';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('api/v1/itsm/sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('policies')
  async listPolicies() {
    return this.slaService.findAllPolicies();
  }

  @Post('policies')
  @HttpCode(HttpStatus.CREATED)
  async createPolicy(@Body() dto: CreateSlaPolicyDto) {
    return this.slaService.createPolicy(dto);
  }

  @Get('dashboard')
  async getDashboard() {
    return this.slaService.getDashboardStats();
  }

  @Get('breaches')
  async getBreaches() {
    return this.slaService.getBreachedTickets();
  }

  @Get('breach-rate')
  async getBreachRate() {
    return this.slaService.getBreachRateBySeverity();
  }

  @Get('at-risk')
  async getAtRisk(@Query('threshold') threshold?: string) {
    return this.slaService.getAtRiskTickets(
      parseInt(threshold || '30', 10) || 30,
    );
  }

  @Get('compliance-trend')
  async getComplianceTrend(@Query('days') days?: string) {
    return this.slaService.getComplianceTrend(
      parseInt(days || '30', 10) || 30,
    );
  }

  @Get('escalation-frequency')
  async getEscalationFrequency(@Query('days') days?: string) {
    return this.slaService.getEscalationFrequency(
      parseInt(days || '30', 10) || 30,
    );
  }
}
