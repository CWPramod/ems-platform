import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivateLicenseDto {
  @ApiProperty({ example: 'CANARIS-SUB-EMS-20260101-...' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^CANARIS-/, { message: 'License key must start with CANARIS-' })
  licenseKey: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsString()
  @IsOptional()
  organizationName?: string;
}
