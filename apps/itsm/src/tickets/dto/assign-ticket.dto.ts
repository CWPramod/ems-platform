import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTicketDto {
  @ApiProperty({ description: 'Operator user ID to assign the ticket to' })
  @IsString()
  @IsNotEmpty()
  assignedTo: string;
}
