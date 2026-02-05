import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcknowledgeAlertDto {
  @ApiProperty({ description: 'Owner/operator acknowledging the alert' })
  @IsString()
  @IsNotEmpty()
  owner: string;
}

export class ResolveAlertDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resolutionCategory?: string;
}

export class UpdateBusinessImpactDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  businessImpactScore: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  affectedUsers?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  revenueAtRisk?: number;
}
