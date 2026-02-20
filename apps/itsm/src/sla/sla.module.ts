import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaPolicy } from './entities/sla-policy.entity';
import { SlaService } from './sla.service';
import { SlaEngineService } from './sla-engine.service';
import { SlaController } from './sla.controller';
import { Ticket } from '../tickets/entities/ticket.entity';
import { TicketHistory } from '../tickets/entities/ticket-history.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SlaPolicy, Ticket, TicketHistory]),
    forwardRef(() => EventsModule),
  ],
  controllers: [SlaController],
  providers: [SlaService, SlaEngineService],
  exports: [SlaService],
})
export class SlaModule {}
