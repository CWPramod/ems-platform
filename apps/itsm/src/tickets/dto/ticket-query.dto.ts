import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class TicketQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value, 10) || 20, 100))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['open', 'acknowledged', 'in_progress', 'pending', 'resolved', 'closed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ enum: ['P1', 'P2', 'P3', 'P4'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ enum: ['incident', 'problem', 'change'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned operator' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Search title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter breached tickets (true/false)' })
  @IsOptional()
  @IsString()
  slaBreach?: string;

  @ApiPropertyOptional({ description: 'Sort field:direction (e.g. created_at:desc)' })
  @IsOptional()
  @IsString()
  sort?: string;
}
