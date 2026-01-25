// Custom Dashboards Controller
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CustomDashboardsService } from './custom-dashboards.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../rbac/guards/rbac.guard';
import { Permissions } from '../../rbac/decorators/rbac.decorators';

@Controller('api/v1/reporting/dashboards')
@UseGuards(JwtAuthGuard)
export class CustomDashboardsController {
  constructor(private readonly dashboardsService: CustomDashboardsService) {}

  @Post()
  @Permissions('dashboards:create')
  @UseGuards(RbacGuard)
  async create(@Body() body: any, @Request() req: any) {
    const dashboard = await this.dashboardsService.create(body, req.user.id);
    return { success: true, data: dashboard };
  }

  @Get()
  @Permissions('dashboards:read')
  @UseGuards(RbacGuard)
  async findAll(@Request() req: any) {
    const dashboards = await this.dashboardsService.findAll(req.user.id);
    return { success: true, data: dashboards };
  }

  @Get(':id')
  @Permissions('dashboards:read')
  @UseGuards(RbacGuard)
  async findOne(@Param('id') id: string) {
    const dashboard = await this.dashboardsService.findOne(parseInt(id));
    return { success: true, data: dashboard };
  }

  @Put(':id')
  @Permissions('dashboards:update')
  @UseGuards(RbacGuard)
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const dashboard = await this.dashboardsService.update(parseInt(id), body, req.user.id);
    return { success: true, data: dashboard };
  }

  @Delete(':id')
  @Permissions('dashboards:delete')
  @UseGuards(RbacGuard)
  async remove(@Param('id') id: string) {
    await this.dashboardsService.remove(parseInt(id));
    return { success: true, message: 'Dashboard deleted' };
  }
}