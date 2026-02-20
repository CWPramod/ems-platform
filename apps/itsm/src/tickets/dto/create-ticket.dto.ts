import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Ticket description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ['incident', 'problem', 'change'] })
  @IsString()
  @IsIn(['incident', 'problem', 'change'])
  type: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsString()
  @IsIn(['critical', 'high', 'medium', 'low'])
  severity: string;

  @ApiProperty({ enum: ['P1', 'P2', 'P3', 'P4'] })
  @IsString()
  @IsIn(['P1', 'P2', 'P3', 'P4'])
  priority: string;

  @ApiPropertyOptional({ description: 'EMS Core asset ID' })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional({ description: 'EMS Core alert ID' })
  @IsString()
  @IsOptional()
  alertId?: string;

  @ApiPropertyOptional({ description: 'Assign to operator (user ID)' })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: ['manual', 'auto_alert', 'email', 'api'], default: 'manual' })
  @IsString()
  @IsOptional()
  @IsIn(['manual', 'auto_alert', 'email', 'api'])
  source?: string;
}
