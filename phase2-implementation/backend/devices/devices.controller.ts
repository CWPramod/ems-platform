// Device Controller
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DevicesService, CreateDeviceDto } from './devices.service';
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
    @Query('customer_id') customerId?: string,
    @Query('location_id') locationId?: string,
    @Query('device_category') deviceCategory?: string,
    @Query('is_critical') isCritical?: string,
    @Query('monitoring_status') monitoringStatus?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const filters: any = {};
    
    if (customerId) filters.customer_id = parseInt(customerId);
    if (locationId) filters.location_id = parseInt(locationId);
    if (deviceCategory) filters.device_category = deviceCategory;
    if (isCritical !== undefined) filters.is_critical = isCritical === 'true';
    if (monitoringStatus) filters.monitoring_status = monitoringStatus;
    if (status) filters.status = status;
    if (search) filters.search = search;

    const devices = await this.devicesService.findAll(filters);
    
    return {
      success: true,
      data: devices,
      count: devices.length,
    };
  }

  /**
   * Get device by ID
   * GET /api/v1/masters/devices/:id
   */
  @Get(':id')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
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
    @Param('id', ParseIntPipe) id: number,
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
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    await this.devicesService.remove(id, userId);
    return {
      success: true,
      message: 'Device deleted successfully',
    };
  }

  /**
   * Get critical devices
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
   * Get device by IP
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
   * Get devices by category
   * GET /api/v1/masters/devices/category/:category
   */
  @Get('category/:category')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getByCategory(@Param('category') category: string) {
    const devices = await this.devicesService.getByCategory(category);
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
    @Param('id', ParseIntPipe) id: number,
    @Body() interfaceData: any,
  ) {
    const deviceInterface = await this.devicesService.addInterface(id, interfaceData);
    return {
      success: true,
      data: deviceInterface,
      message: 'Interface added successfully',
    };
  }

  /**
   * Get device interfaces
   * GET /api/v1/masters/devices/:id/interfaces
   */
  @Get(':id/interfaces')
  @Permissions('device:read')
  @UseGuards(RbacGuard)
  async getInterfaces(@Param('id', ParseIntPipe) id: number) {
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
    const deviceInterface = await this.devicesService.updateInterface(interfaceId, updateData);
    return {
      success: true,
      data: deviceInterface,
      message: 'Interface updated successfully',
    };
  }

  /**
   * Import devices from CSV/Excel
   * POST /api/v1/masters/devices/import
   */
  @Post('import')
  @Permissions('device:create')
  @UseGuards(RbacGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importDevices(
    @UploadedFile() file: Express.Multer.File,
    @UserId() userId: number,
  ) {
    // TODO: Parse CSV/Excel file
    // For now, accept JSON array in body
    // In production, use a CSV parser library
    
    return {
      success: true,
      message: 'Import functionality to be implemented with CSV parser',
    };
  }

  /**
   * Toggle device monitoring
   * POST /api/v1/masters/devices/:id/toggle-monitoring
   */
  @Post(':id/toggle-monitoring')
  @Permissions('device:update')
  @UseGuards(RbacGuard)
  async toggleMonitoring(
    @Param('id', ParseIntPipe) id: number,
    @Body('enabled') enabled: boolean,
  ) {
    const device = await this.devicesService.toggleMonitoring(id, enabled);
    return {
      success: true,
      data: device,
      message: `Monitoring ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  }
}
