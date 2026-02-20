import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiPropertyOptional({ enum: ['public', 'internal'], default: 'internal' })
  @IsString()
  @IsOptional()
  @IsIn(['public', 'internal'])
  visibility?: string;
}
