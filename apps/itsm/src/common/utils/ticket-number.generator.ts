import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TicketNumberGenerator {
  constructor(private readonly dataSource: DataSource) {}

  async generate(type: string): Promise<string> {
    const prefixMap: Record<string, string> = {
      incident: 'INC',
      problem: 'PRB',
      change: 'CHG',
    };

    const prefix = prefixMap[type] || 'INC';
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Atomic upsert — concurrency-safe
    const result = await this.dataSource.query(
      `INSERT INTO ticket_counters (prefix, counter_date, counter)
       VALUES ($1, $2, 1)
       ON CONFLICT (prefix, counter_date)
       DO UPDATE SET counter = ticket_counters.counter + 1
       RETURNING counter`,
      [prefix, today.toISOString().slice(0, 10)],
    );

    const counter = result[0].counter;
    const paddedCounter = String(counter).padStart(4, '0');

    return `${prefix}-${dateStr}-${paddedCounter}`;
  }
}
