// Monitoring Module (Complete)
// Organizes all monitoring services: Dashboard, Drill-down, Topology, Top Talkers
// apps/api/src/monitoring/monitoring.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Services
import { DashboardService } from './dashboard/dashboard.service';
import { DrilldownService } from './drilldown/drilldown.service';
import { TopologyService } from './topology/topology.service';
import { TopTalkersService } from './top-talkers/top-talkers.service';
import { SnmpMonitorService } from './services/snmp-monitor.service';
import { TrafficFlowGeneratorService } from './services/traffic-flow-generator.service';

// Controllers
import { DashboardController } from './dashboard/dashboard.controller';
import { DrilldownController } from './drilldown/drilldown.controller';
import { TopologyController } from './topology/topology.controller';
import { TopTalkersController } from './top-talkers/top-talkers.controller';

// Entities
import { Asset } from '../entities/asset.entity';
import { DeviceHealth } from '../entities/device-health.entity';
import { DeviceInterface } from '../entities/device-interface.entity';
import { DeviceMetricsHistory } from '../entities/device-metrics-history.entity';
import { DeviceConnection } from '../entities/device-connection.entity';
import { TrafficFlow } from '../entities/traffic-flow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      DeviceHealth,
      DeviceInterface,
      DeviceMetricsHistory,
      DeviceConnection,
      TrafficFlow,
    ]),
  ],
  controllers: [
    DashboardController,
    DrilldownController,
    TopologyController,
    TopTalkersController,
  ],
  providers: [
    DashboardService,
    DrilldownService,
    TopologyService,
    TopTalkersService,
    SnmpMonitorService,
    TrafficFlowGeneratorService,
  ],
  exports: [
    DashboardService,
    DrilldownService,
    TopologyService,
    TopTalkersService,
    SnmpMonitorService,
    TrafficFlowGeneratorService,
  ],
})
export class MonitoringModule {}
