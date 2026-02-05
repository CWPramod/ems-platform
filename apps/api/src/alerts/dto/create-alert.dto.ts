import { IsUUID, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlertDto {
  @ApiProperty({ description: 'Event ID that triggered this alert' })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rootCauseAssetId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  team?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  businessImpactScore?: number;
}
