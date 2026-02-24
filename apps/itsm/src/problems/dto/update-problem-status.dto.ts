import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProblemStatusDto {
  @ApiProperty({
    enum: ['open', 'investigating', 'known_error', 'resolved', 'closed'],
  })
  @IsString()
  @IsIn(['open', 'investigating', 'known_error', 'resolved', 'closed'])
  status: string;
}
