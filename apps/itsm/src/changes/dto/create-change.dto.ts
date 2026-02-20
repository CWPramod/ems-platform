import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChangeDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  riskLevel?: string;

  @ApiPropertyOptional({
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'implemented', 'rolled_back'],
    default: 'draft',
  })
  @IsString()
  @IsOptional()
  @IsIn(['draft', 'pending_approval', 'approved', 'rejected', 'implemented', 'rolled_back'])
  approvalStatus?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledStart?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledEnd?: string;
}
