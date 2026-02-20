import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketComment } from '../tickets/entities/ticket-comment.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(TicketComment)
    private readonly commentRepo: Repository<TicketComment>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async create(ticketId: string, dto: CreateCommentDto, userId: string): Promise<TicketComment> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    const comment = this.commentRepo.create({
      ticketId,
      comment: dto.comment,
      visibility: dto.visibility || 'internal',
      createdBy: userId,
    });

    return this.commentRepo.save(comment);
  }

  async findByTicket(ticketId: string): Promise<TicketComment[]> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    return this.commentRepo.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });
  }
}
