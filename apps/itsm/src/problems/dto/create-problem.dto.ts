import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProblemDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rootCause?: string;

  @ApiPropertyOptional({
    enum: ['open', 'investigating', 'known_error', 'resolved', 'closed'],
    default: 'open',
  })
  @IsString()
  @IsOptional()
  @IsIn(['open', 'investigating', 'known_error', 'resolved', 'closed'])
  status?: string;
}
