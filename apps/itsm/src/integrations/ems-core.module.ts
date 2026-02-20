import { Module } from '@nestjs/common';
import { EmsCoreClient } from './ems-core.client';

@Module({
  providers: [EmsCoreClient],
  exports: [EmsCoreClient],
})
export class EmsCoreModule {}
