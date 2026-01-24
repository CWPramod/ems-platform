// Masters Module
// Combines all master data modules (Customers, Devices, Thresholds)
// apps/api/src/masters/masters.module.ts

import { Module } from '@nestjs/common';
import { CustomersModule } from './customers/customers.module';
import { DevicesModule } from './devices/devices.module';
import { ThresholdsModule } from './thresholds/thresholds.module';

@Module({
  imports: [
    CustomersModule,
    DevicesModule,
    ThresholdsModule,
  ],
  exports: [
    CustomersModule,
    DevicesModule,
    ThresholdsModule,
  ],
})
export class MastersModule {}
