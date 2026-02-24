import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChangeDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'] })
  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  riskLevel?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledStart?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledEnd?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  implementationNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rollbackPlan?: string;
}
