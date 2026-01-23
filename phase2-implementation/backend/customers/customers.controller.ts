// Customer Controller
// REST API endpoints for customer management
// apps/api/src/masters/customers/customers.controller.ts

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
import { CustomersService, CreateCustomerDto, CreateLocationDto } from './customers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions, UserId } from '../../rbac/decorators/rbac.decorators';

@Controller('api/v1/masters/customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * Create a new customer
   * POST /api/v1/masters/customers
   */
  @Post()
  @Permissions('customer:create')
  @UseGuards(RbacGuard)
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @UserId() userId: number,
  ) {
    const customer = await this.customersService.create(createCustomerDto, userId);
    return {
      success: true,
      data: customer,
      message: 'Customer created successfully',
    };
  }

  /**
   * Get all customers
   * GET /api/v1/masters/customers
   */
  @Get()
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async findAll(
    @Query('customer_type') customerType?: string,
    @Query('is_active') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filters: any = {};
    
    if (customerType) {
      filters.customer_type = customerType;
    }
    
    if (isActive !== undefined) {
      filters.is_active = isActive === 'true';
    }
    
    if (search) {
      filters.search = search;
    }

    const customers = await this.customersService.findAll(filters);
    
    return {
      success: true,
      data: customers,
      count: customers.length,
    };
  }

  /**
   * Get customer by ID
   * GET /api/v1/masters/customers/:id
   */
  @Get(':id')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const customer = await this.customersService.findOne(id);
    return {
      success: true,
      data: customer,
    };
  }

  /**
   * Update customer
   * PUT /api/v1/masters/customers/:id
   */
  @Put(':id')
  @Permissions('customer:update')
  @UseGuards(RbacGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: Partial<CreateCustomerDto>,
    @UserId() userId: number,
  ) {
    const customer = await this.customersService.update(id, updateCustomerDto, userId);
    return {
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    };
  }

  /**
   * Delete customer (soft delete)
   * DELETE /api/v1/masters/customers/:id
   */
  @Delete(':id')
  @Permissions('customer:delete')
  @UseGuards(RbacGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    await this.customersService.remove(id, userId);
    return {
      success: true,
      message: 'Customer deleted successfully',
    };
  }

  /**
   * Get customer hierarchy
   * GET /api/v1/masters/customers/:id/hierarchy
   */
  @Get(':id/hierarchy')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getHierarchy(@Param('id', ParseIntPipe) id: number) {
    const hierarchy = await this.customersService.getHierarchy(id);
    return {
      success: true,
      data: hierarchy,
    };
  }

  /**
   * Get all head offices
   * GET /api/v1/masters/customers/head-offices
   */
  @Get('list/head-offices')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getHeadOffices() {
    const headOffices = await this.customersService.getHeadOffices();
    return {
      success: true,
      data: headOffices,
      count: headOffices.length,
    };
  }

  /**
   * Get branches for a customer
   * GET /api/v1/masters/customers/:id/branches
   */
  @Get(':id/branches')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getBranches(@Param('id', ParseIntPipe) id: number) {
    const branches = await this.customersService.getBranches(id);
    return {
      success: true,
      data: branches,
      count: branches.length,
    };
  }

  /**
   * Create location for customer
   * POST /api/v1/masters/customers/:id/locations
   */
  @Post(':id/locations')
  @Permissions('customer:create')
  @UseGuards(RbacGuard)
  async createLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() createLocationDto: CreateLocationDto,
  ) {
    const location = await this.customersService.createLocation(id, createLocationDto);
    return {
      success: true,
      data: location,
      message: 'Location created successfully',
    };
  }

  /**
   * Get locations for customer
   * GET /api/v1/masters/customers/:id/locations
   */
  @Get(':id/locations')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getLocations(@Param('id', ParseIntPipe) id: number) {
    const locations = await this.customersService.getLocations(id);
    return {
      success: true,
      data: locations,
      count: locations.length,
    };
  }

  /**
   * Get all locations (including child customers)
   * GET /api/v1/masters/customers/:id/all-locations
   */
  @Get(':id/all-locations')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getAllLocations(@Param('id', ParseIntPipe) id: number) {
    const locations = await this.customersService.getAllLocations(id);
    return {
      success: true,
      data: locations,
      count: locations.length,
    };
  }

  /**
   * Update location
   * PUT /api/v1/masters/customers/locations/:locationId
   */
  @Put('locations/:locationId')
  @Permissions('customer:update')
  @UseGuards(RbacGuard)
  async updateLocation(
    @Param('locationId', ParseIntPipe) locationId: number,
    @Body() updateLocationDto: Partial<CreateLocationDto>,
  ) {
    const location = await this.customersService.updateLocation(locationId, updateLocationDto);
    return {
      success: true,
      data: location,
      message: 'Location updated successfully',
    };
  }

  /**
   * Delete location
   * DELETE /api/v1/masters/customers/locations/:locationId
   */
  @Delete('locations/:locationId')
  @Permissions('customer:delete')
  @UseGuards(RbacGuard)
  async removeLocation(@Param('locationId', ParseIntPipe) locationId: number) {
    await this.customersService.removeLocation(locationId);
    return {
      success: true,
      message: 'Location deleted successfully',
    };
  }

  /**
   * Get customer statistics
   * GET /api/v1/masters/customers/stats
   */
  @Get('stats/overview')
  @Permissions('customer:read')
  @UseGuards(RbacGuard)
  async getStatistics() {
    const stats = await this.customersService.getStatistics();
    return {
      success: true,
      data: stats,
    };
  }
}
