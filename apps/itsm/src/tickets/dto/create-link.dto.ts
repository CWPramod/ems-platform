import { IsString, IsNotEmpty, IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLinkDto {
  @ApiProperty({ description: 'Target ticket ID to link to' })
  @IsUUID()
  @IsNotEmpty()
  targetTicketId: string;

  @ApiProperty({ enum: ['related', 'duplicate', 'caused_by', 'parent_child'] })
  @IsString()
  @IsIn(['related', 'duplicate', 'caused_by', 'parent_child'])
  linkType: string;
}
