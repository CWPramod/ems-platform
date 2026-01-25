// Custom Dashboards Service
// Manages user-created dashboards with drill-down capabilities
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardConfig } from '../../entities/dashboard-config.entity';

@Injectable()
export class CustomDashboardsService {
  constructor(
    @InjectRepository(DashboardConfig)
    private dashboardRepo: Repository<DashboardConfig>,
  ) {}

  async create(dashboardData: Partial<DashboardConfig>, userId: number) {
    const dashboard = this.dashboardRepo.create({
      ...dashboardData,
      createdBy: userId,
    });
    return this.dashboardRepo.save(dashboard);
  }

  async findAll(userId?: number) {
    const query = this.dashboardRepo.createQueryBuilder('d');
    
    if (userId) {
      query.where('d.user_id = :userId OR d.is_public = TRUE', { userId });
    } else {
      query.where('d.is_public = TRUE');
    }
    
    return query.getMany();
  }

  async findOne(id: number) {
    return this.dashboardRepo.findOne({ where: { id } });
  }

  async update(id: number, updates: Partial<DashboardConfig>, userId: number) {
    await this.dashboardRepo.update(id, {
      ...updates,
      updatedBy: userId,
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.dashboardRepo.delete(id);
  }
}