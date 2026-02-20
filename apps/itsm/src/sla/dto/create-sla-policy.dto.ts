import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSlaPolicyDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] })
  @IsString()
  @IsIn(['critical', 'high', 'medium', 'low'])
  severity: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  responseTimeMinutes: number;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  resolutionTimeMinutes: number;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  escalationLevel1Minutes: number;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  escalationLevel2Minutes: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
