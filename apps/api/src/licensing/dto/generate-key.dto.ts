import { IsString, IsNotEmpty, IsNumber, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateKeyDto {
  @ApiProperty({ enum: ['trial', 'subscription', 'perpetual'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['trial', 'subscription', 'perpetual'])
  type: 'trial' | 'subscription' | 'perpetual';

  @ApiProperty({ enum: ['nms_only', 'ems_full'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['nms_only', 'ems_full'])
  tier: 'nms_only' | 'ems_full';

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @IsNumber()
  @Min(1)
  @Max(100000)
  maxDevices: number;

  @ApiProperty({ minimum: 1, maximum: 3650 })
  @IsNumber()
  @Min(1)
  @Max(3650)
  durationDays: number;
}
