// Thresholds Controller
// REST API endpoints for threshold rule management
// apps/api/src/masters/thresholds/thresholds.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThresholdsService } from './thresholds.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions, UserId } from '../../rbac/decorators/rbac.decorators';

@ApiTags('masters')
@Controller('api/v1/masters/thresholds')
@UseGuards(JwtAuthGuard)
export class ThresholdsController {
  constructor(private readonly thresholdsService: ThresholdsService) {}

  /**
   * Create a new threshold rule
   * POST /api/v1/masters/thresholds
   */
  @Post()
  @Permissions('threshold:create')
  @UseGuards(RbacGuard)
  async create(
    @Body() createThresholdDto: any,
    @UserId() userId: number,
  ) {
    const threshold = await this.thresholdsService.create(createThresholdDto, userId);
    return {
      success: true,
      data: threshold,
      message: 'Threshold rule created successfully',
    };
  }

  /**
   * Get all threshold rules
   * GET /api/v1/masters/thresholds
   */
  @Get()
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async findAll(
    @Query('kpi_code') kpiCode?: string,
    @Query('asset_id') assetId?: string,
    @Query('customer_id') customerId?: string,
    @Query('is_active') isActive?: string,
    @Query('severity') severity?: string,
  ) {
    const filters: any = {};

    if (kpiCode) filters.kpiCode = kpiCode;
    if (assetId) filters.assetId = assetId;
    if (customerId) filters.customerId = parseInt(customerId);
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (severity) filters.severity = severity;

    const thresholds = await this.thresholdsService.findAll(filters);

    return {
      success: true,
      data: thresholds,
      count: thresholds.length,
    };
  }

  /**
   * Get threshold rule by ID
   * GET /api/v1/masters/thresholds/:id
   */
  @Get(':id')
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const threshold = await this.thresholdsService.findOne(id);
    return {
      success: true,
      data: threshold,
    };
  }

  /**
   * Update threshold rule
   * PUT /api/v1/masters/thresholds/:id
   */
  @Put(':id')
  @Permissions('threshold:update')
  @UseGuards(RbacGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateThresholdDto: any,
    @UserId() userId: number,
  ) {
    const threshold = await this.thresholdsService.update(id, updateThresholdDto, userId);
    return {
      success: true,
      data: threshold,
      message: 'Threshold rule updated successfully',
    };
  }

  /**
   * Delete threshold rule
   * DELETE /api/v1/masters/thresholds/:id
   */
  @Delete(':id')
  @Permissions('threshold:delete')
  @UseGuards(RbacGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.thresholdsService.remove(id);
    return {
      success: true,
      message: 'Threshold rule deleted successfully',
    };
  }

  /**
   * Get applicable thresholds for an asset
   * GET /api/v1/masters/thresholds/applicable/:assetId
   */
  @Get('applicable/:assetId')
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async getApplicableThresholds(@Param('assetId') assetId: string) {
    const thresholds = await this.thresholdsService.getApplicableThresholds(assetId);
    return {
      success: true,
      data: thresholds,
      count: thresholds.length,
    };
  }

  /**
   * Check if value breaches threshold
   * POST /api/v1/masters/thresholds/:id/check
   */
  @Post(':id/check')
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async checkBreach(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { value: number },
  ) {
    const result = await this.thresholdsService.checkBreach(id, body.value);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get breach history for a threshold
   * GET /api/v1/masters/thresholds/:id/breaches
   */
  @Get(':id/breaches')
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async getBreachHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const breaches = await this.thresholdsService.getBreachHistory(
      id,
      limit ? parseInt(limit) : 100,
    );
    return {
      success: true,
      data: breaches,
      count: breaches.length,
    };
  }

  /**
   * Get threshold statistics
   * GET /api/v1/masters/thresholds/stats/overview
   */
  @Get('stats/overview')
  @Permissions('threshold:read')
  @UseGuards(RbacGuard)
  async getStatistics() {
    const stats = await this.thresholdsService.getStatistics();
    return {
      success: true,
      data: stats,
    };
  }
}
