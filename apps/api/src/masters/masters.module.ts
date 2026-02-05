// Masters Module
// Combines all master data modules (Customers, Devices, Thresholds)
// apps/api/src/masters/masters.module.ts

import { Module } from '@nestjs/common';
import { CustomersModule } from './customers/customers.module';
import { DevicesModule } from './devices/devices.module';
import { ThresholdsModule } from './thresholds/thresholds.module';
import { DiscoveryModule } from './discovery/discovery.module';

@Module({
  imports: [
    CustomersModule,
    DevicesModule,
    ThresholdsModule,
    DiscoveryModule,
  ],
  exports: [
    CustomersModule,
    DevicesModule,
    ThresholdsModule,
    DiscoveryModule,
  ],
})
export class MastersModule {}
