import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketHistory } from '../../tickets/entities/ticket-history.entity';

/**
 * Audit interceptor that records field changes on ticket mutations.
 * Used on PATCH endpoints — compares before/after state and writes
 * individual TicketHistory entries for each changed field.
 *
 * Note: The primary audit logging for status changes is done directly
 * in TicketsService for precision. This interceptor can be applied to
 * additional mutation endpoints as needed.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(TicketHistory)
    private readonly historyRepo: Repository<TicketHistory>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const ticketId = request.params?.id;

    // Only audit if there's a ticket ID in the route
    if (!ticketId) {
      return next.handle();
    }

    const beforeBody = { ...request.body };

    return next.handle().pipe(
      tap(async (result) => {
        if (!result || !result.id) return;

        // For each field in the request body that was changed,
        // record it in the audit trail
        const auditableFields = [
          'title', 'description', 'severity', 'priority',
          'type', 'assignedTo', 'resolutionNotes',
        ];

        for (const field of auditableFields) {
          if (beforeBody[field] !== undefined && result[field] !== undefined) {
            // Only record if the value is in the request body
            // (status changes are recorded by TicketsService directly)
            if (String(beforeBody[field]) !== String(result[field])) {
              await this.historyRepo.save(
                this.historyRepo.create({
                  ticketId: result.id,
                  fieldChanged: field,
                  oldValue: String(result[field]),
                  newValue: String(beforeBody[field]),
                  changedBy: userId,
                }),
              );
            }
          }
        }
      }),
    );
  }
}
