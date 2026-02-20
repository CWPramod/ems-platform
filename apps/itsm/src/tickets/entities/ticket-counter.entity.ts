import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('ticket_counters')
export class TicketCounter {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  prefix: string;

  @PrimaryColumn({ name: 'counter_date', type: 'date' })
  counterDate: string;

  @Column({ type: 'int', default: 0 })
  counter: number;
}
