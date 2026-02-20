import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_links')
@Index('idx_ticket_links_source', ['sourceTicketId'])
@Index('idx_ticket_links_target', ['targetTicketId'])
@Unique(['sourceTicketId', 'targetTicketId', 'linkType'])
export class TicketLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_ticket_id', type: 'uuid' })
  sourceTicketId: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_ticket_id' })
  sourceTicket: Ticket;

  @Column({ name: 'target_ticket_id', type: 'uuid' })
  targetTicketId: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_ticket_id' })
  targetTicket: Ticket;

  @Column({ name: 'link_type', type: 'varchar', length: 30 })
  linkType: string; // related, duplicate, caused_by, parent_child

  @Column({ name: 'created_by', type: 'varchar', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
