import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChangeStatusDto {
  @ApiProperty({
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'implemented', 'rolled_back'],
  })
  @IsString()
  @IsIn(['draft', 'pending_approval', 'approved', 'rejected', 'implemented', 'rolled_back'])
  approvalStatus: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  implementationNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  rollbackPlan?: string;
}
