import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';
import { Change } from './entities/change.entity';
import { TicketNumberGenerator } from '../common/utils/ticket-number.generator';

@Module({
  imports: [TypeOrmModule.forFeature([Change])],
  controllers: [ChangesController],
  providers: [ChangesService, TicketNumberGenerator],
  exports: [ChangesService],
})
export class ChangesModule {}
