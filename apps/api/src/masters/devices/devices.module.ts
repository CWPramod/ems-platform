// Devices Module
// apps/api/src/masters/devices/devices.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { Asset } from '../../entities/asset.entity';
import { DeviceInterface } from '../../entities/device-interface.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, DeviceInterface])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
