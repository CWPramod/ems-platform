import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import * as crypto from 'crypto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
  ) {}

  // Generate fingerprint for deduplication
  private generateFingerprint(event: Partial<Event>): string {
    const source = event.source || '';
    const assetId = event.assetId || '';
    const category = event.category || '';
    const title = event.title || '';
    
    const data = `${source}:${assetId}:${category}:${title}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async create(eventData: Partial<Event>): Promise<Event> {
    const fingerprint = this.generateFingerprint(eventData);
    const now = new Date();

    // Check if event with same fingerprint exists
    const existingEvent = await this.eventsRepository.findOne({
      where: { fingerprint },
    });

    if (existingEvent) {
      // Update occurrence count and lastOccurrence
      existingEvent.occurrenceCount += 1;
      existingEvent.lastOccurrence = now;
      return await this.eventsRepository.save(existingEvent);
    }

    // Create new event
    const event = this.eventsRepository.create({
      ...eventData,
      fingerprint,
      timestamp: eventData.timestamp || now,
      firstOccurrence: now,
      lastOccurrence: now,
      occurrenceCount: 1,
    });

    return await this.eventsRepository.save(event);
  }

  async findAll(filters?: {
    source?: string;
    severity?: string;
    assetId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Event[]; total: number }> {
    const queryBuilder = this.eventsRepository.createQueryBuilder('event');

    if (filters?.source) {
      queryBuilder.andWhere('event.source = :source', { source: filters.source });
    }
    if (filters?.severity) {
      queryBuilder.andWhere('event.severity = :severity', { severity: filters.severity });
    }
    if (filters?.assetId) {
      queryBuilder.andWhere('event.assetId = :assetId', { assetId: filters.assetId });
    }
    if (filters?.from && filters?.to) {
      queryBuilder.andWhere('event.timestamp BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    }

    // Pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    queryBuilder.take(limit).skip(offset);

    // Order by most recent
    queryBuilder.orderBy('event.timestamp', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Event | null> {
    return await this.eventsRepository.findOne({ where: { id } });
  }
}