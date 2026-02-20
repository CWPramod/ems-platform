import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { TicketHistory } from './entities/ticket-history.entity';
import { TicketLink } from './entities/ticket-link.entity';
import { TicketCounter } from './entities/ticket-counter.entity';
import { TicketNumberGenerator } from '../common/utils/ticket-number.generator';
import { SlaModule } from '../sla/sla.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketHistory, TicketLink, TicketCounter]),
    SlaModule,
    forwardRef(() => EventsModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, TicketNumberGenerator],
  exports: [TicketsService],
})
export class TicketsModule {}
