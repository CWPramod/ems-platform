import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkIncidentDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;
}
