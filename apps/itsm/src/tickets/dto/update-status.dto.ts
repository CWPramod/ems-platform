import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({
    enum: ['open', 'acknowledged', 'in_progress', 'pending', 'resolved', 'closed'],
  })
  @IsString()
  @IsIn(['open', 'acknowledged', 'in_progress', 'pending', 'resolved', 'closed'])
  status: string;

  @ApiPropertyOptional({ description: 'Required when transitioning to resolved' })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
