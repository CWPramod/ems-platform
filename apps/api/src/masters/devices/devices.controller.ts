// Devices Controller
// REST API endpoints for device/asset management
// apps/api/src/masters/devices/devices.controller.ts

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
import { DevicesService } from './devices.service';
import type { CreateDeviceDto } from './devices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions, UserId } from '../../rbac/decorators/rbac.decorators';

@Controller('api/v1/masters/devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * Create a new device
   * POST /api/v1/masters/devices
   */
  @Post()
  @Permissions('device:create')
  @UseGuards(RbacGuard)
  async create(
    @Body() createDeviceDto: CreateDeviceDto,
    @UserId() userId: number,
  ) {
    const device = await this.devicesService.create(createDeviceDto, userId);
    return {
      success: true,
      data: device,
      message: 'Device created successfully',
    };
  }

  /**
   * Get all devices
   * GET /api/v1/masters/devices
   */
  @Get()
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async findAll(
    @Query('type') type?: string,
    @Query('location') location?: string,
    @Query('vendor') vendor?: string,
    @Query('tier') tier?: string,
    @Query('monitoring_enabled') monitoringEnabled?: string,
    @Query('search') search?: string,
  ) {
    const filters: any = {};

    if (type) filters.type = type;
    if (location) filters.location = location;
    if (vendor) filters.vendor = vendor;
    if (tier) filters.tier = parseInt(tier);
    if (monitoringEnabled !== undefined) {
      filters.monitoringEnabled = monitoringEnabled === 'true';
    }
    if (search) filters.search = search;

    const devices = await this.devicesService.findAll(filters);

    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get device by ID (with interfaces)
   * GET /api/v1/masters/devices/:id
   */
  @Get(':id')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async findOne(@Param('id') id: string) {
    const device = await this.devicesService.findOne(id);
    return {
      success: true,
      data: device,
    };
  }

  /**
   * Update device
   * PUT /api/v1/masters/devices/:id
   */
  @Put(':id')
  @Permissions('device:update')
  @UseGuards(RbacGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDeviceDto: Partial<CreateDeviceDto>,
    @UserId() userId: number,
  ) {
    const device = await this.devicesService.update(id, updateDeviceDto, userId);
    return {
      success: true,
      data: device,
      message: 'Device updated successfully',
    };
  }

  /**
   * Delete device
   * DELETE /api/v1/masters/devices/:id
   */
  @Delete(':id')
  @Permissions('device:delete')
  @UseGuards(RbacGuard)
  async remove(
    @Param('id') id: string,
    @UserId() userId: number,
  ) {
    await this.devicesService.remove(id, userId);
    return {
      success: true,
      message: 'Device deleted successfully',
    };
  }

  /**
   * Get critical devices (tier 1)
   * GET /api/v1/masters/devices/list/critical
   */
  @Get('list/critical')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getCriticalDevices() {
    const devices = await this.devicesService.getCriticalDevices();
    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Find device by IP address
   * GET /api/v1/masters/devices/ip/:ipAddress
   */
  @Get('ip/:ipAddress')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async findByIp(@Param('ipAddress') ipAddress: string) {
    const device = await this.devicesService.findByIpAddress(ipAddress);
    return {
      success: true,
      data: device,
    };
  }

  /**
   * Get devices by type
   * GET /api/v1/masters/devices/type/:type
   */
  @Get('type/:type')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getByType(@Param('type') type: string) {
    const devices = await this.devicesService.getByType(type);
    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get device statistics
   * GET /api/v1/masters/devices/stats/overview
   */
  @Get('stats/overview')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getStatistics() {
    const stats = await this.devicesService.getStatistics();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Add interface to device
   * POST /api/v1/masters/devices/:id/interfaces
   */
  @Post(':id/interfaces')
  @Permissions('device:update')
  @UseGuards(RbacGuard)
  async addInterface(
    @Param('id') id: string,
    @Body() interfaceData: any,
  ) {
    const interface_ = await this.devicesService.addInterface(id, interfaceData);
    return {
      success: true,
      data: interface_,
      message: 'Interface added successfully',
    };
  }

  /**
   * Get interfaces for device
   * GET /api/v1/masters/devices/:id/interfaces
   */
  @Get(':id/interfaces')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getInterfaces(@Param('id') id: string) {
    const interfaces = await this.devicesService.getInterfaces(id);
    return {
      success: true,
      data: interfaces,
      count: interfaces.length,
    };
  }

  /**
   * Update interface
   * PUT /api/v1/masters/devices/interfaces/:interfaceId
   */
  @Put('interfaces/:interfaceId')
  @Permissions('device:update')
  @UseGuards(RbacGuard)
  async updateInterface(
    @Param('interfaceId', ParseIntPipe) interfaceId: number,
    @Body() updateData: any,
  ) {
    const interface_ = await this.devicesService.updateInterface(interfaceId, updateData);
    return {
      success: true,
      data: interface_,
      message: 'Interface updated successfully',
    };
  }

  /**
   * Toggle monitoring for device
   * POST /api/v1/masters/devices/:id/toggle-monitoring
   */
  @Post(':id/toggle-monitoring')
  @Permissions('device:update')
  @UseGuards(RbacGuard)
  async toggleMonitoring(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    const device = await this.devicesService.toggleMonitoring(id, body.enabled);
    return {
      success: true,
      data: device,
      message: `Monitoring ${body.enabled ? 'enabled' : 'disabled'} successfully`,
    };
  }
}
