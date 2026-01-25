# Phase 4 - Reporting & Analytics - Files Created

## Files Already Created (Download from outputs):

### Entities (4 files):
1. **report-definition.entity.ts** → `src/entities/`
2. **report-schedule.entity.ts** → `src/entities/`
3. **report-history.entity.ts** → `src/entities/`
4. **dashboard-config.entity.ts** → `src/entities/`

### Services & Controllers (2 files):
5. **reports.service.ts** → `src/reporting/reports/`
6. **reports.controller.ts** → `src/reporting/reports/`

## Files to Create:

### Custom Dashboards Service:
Create: `src/reporting/dashboards/custom-dashboards.service.ts`

```typescript
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
```

### Custom Dashboards Controller:
Create: `src/reporting/dashboards/custom-dashboards.controller.ts`

```typescript
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
```

### Reporting Module:
Create: `src/reporting/reporting.module.ts`

```typescript
// Reporting Module
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';
import { CustomDashboardsService } from './dashboards/custom-dashboards.service';
import { CustomDashboardsController } from './dashboards/custom-dashboards.controller';
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';
import { ReportDefinition } from '../entities/report-definition.entity';
import { ReportSchedule } from '../entities/report-schedule.entity';
import { ReportHistory } from '../entities/report-history.entity';
import { DashboardConfig } from '../entities/dashboard-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      DeviceHealth,
      DeviceMetricsHistory,
      ReportDefinition,
      ReportSchedule,
      ReportHistory,
      DashboardConfig,
    ]),
  ],
  controllers: [ReportsController, CustomDashboardsController],
  providers: [ReportsService, CustomDashboardsService],
  exports: [ReportsService, CustomDashboardsService],
})
export class ReportingModule {}
```

### Update app.module.ts:
Add to imports:
```typescript
import { ReportingModule } from './reporting/reporting.module';

imports: [
  // ... existing modules
  MonitoringModule,
  ReportingModule,  // ADD THIS
  // ... rest
],
```

## SQL Migration:

Save as: `phase4-implementation/migrations/011_add_reporting_tables.sql`

```sql
-- Phase 4: Reporting & Analytics Tables
-- Migration: 011_add_reporting_tables.sql

-- Create report_definitions table
CREATE TABLE IF NOT EXISTS report_definitions (
  id SERIAL PRIMARY KEY,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  description TEXT,
  format VARCHAR(50) DEFAULT 'pdf',
  parameters JSONB NOT NULL,
  filters JSONB,
  columns JSONB,
  sorting JSONB,
  grouping JSONB,
  include_charts BOOLEAN DEFAULT TRUE,
  include_summary BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id SERIAL PRIMARY KEY,
  report_definition_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  schedule_name VARCHAR(255) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  cron_expression VARCHAR(100),
  time_of_day TIME,
  day_of_week INTEGER,
  day_of_month INTEGER,
  recipients JSONB NOT NULL,
  email_subject VARCHAR(500),
  email_body TEXT,
  attach_report BOOLEAN DEFAULT TRUE,
  include_link BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  run_count INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id SERIAL PRIMARY KEY,
  report_definition_id INTEGER NOT NULL REFERENCES report_definitions(id),
  schedule_id INTEGER REFERENCES report_schedules(id),
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  format VARCHAR(50) NOT NULL,
  file_path VARCHAR(500),
  file_size BIGINT,
  status VARCHAR(50) NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  row_count INTEGER,
  error_message TEXT,
  parameters JSONB,
  generated_by INTEGER,
  is_scheduled BOOLEAN DEFAULT FALSE,
  is_emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create dashboard_configurations table
CREATE TABLE IF NOT EXISTS dashboard_configurations (
  id SERIAL PRIMARY KEY,
  dashboard_name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,
  widgets JSONB NOT NULL,
  refresh_interval INTEGER DEFAULT 300,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  user_id INTEGER,
  shared_with JSONB,
  filters JSONB,
  theme VARCHAR(50) DEFAULT 'light',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_report_defs_type ON report_definitions(report_type);
CREATE INDEX idx_report_schedules_active ON report_schedules(is_active);
CREATE INDEX idx_report_history_def ON report_history(report_definition_id);
CREATE INDEX idx_report_history_status ON report_history(status);
CREATE INDEX idx_dashboards_user ON dashboard_configurations(user_id);
CREATE INDEX idx_dashboards_public ON dashboard_configurations(is_public);

-- Comments
COMMENT ON TABLE report_definitions IS 'Report template definitions';
COMMENT ON TABLE report_schedules IS 'Scheduled report configurations';
COMMENT ON TABLE report_history IS 'Generated report execution history';
COMMENT ON TABLE dashboard_configurations IS 'Custom user dashboards with drill-down widgets';
```

## Folder Structure to Create:

```
apps/api/src/
├── reporting/
│   ├── reports/
│   │   ├── reports.service.ts
│   │   └── reports.controller.ts
│   ├── dashboards/
│   │   ├── custom-dashboards.service.ts
│   │   └── custom-dashboards.controller.ts
│   └── reporting.module.ts
```

## API Endpoints Added:

### Reports (5 endpoints):
- POST /api/v1/reporting/reports/sla
- POST /api/v1/reporting/reports/uptime
- POST /api/v1/reporting/reports/performance
- GET /api/v1/reporting/reports/history
- GET /api/v1/reporting/reports/health

### Custom Dashboards (5 endpoints):
- POST /api/v1/reporting/dashboards
- GET /api/v1/reporting/dashboards
- GET /api/v1/reporting/dashboards/:id
- PUT /api/v1/reporting/dashboards/:id
- DELETE /api/v1/reporting/dashboards/:id

Total: 10 new REST endpoints!
