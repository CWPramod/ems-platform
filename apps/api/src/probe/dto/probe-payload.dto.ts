import { IsString, IsNotEmpty, IsISO8601, IsArray, ValidateNested, IsBoolean, IsNumber, IsOptional, IsIP, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceMetricsDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUtilization: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  memoryUtilization: number;

  @IsNumber()
  @Min(0)
  bandwidthIn: number;

  @IsNumber()
  @Min(0)
  bandwidthOut: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  packetLoss: number;

  @IsNumber()
  @Min(0)
  latency: number;
}

export class DeviceDataDto {
  @IsString()
  @IsNotEmpty()
  assetId: string;

  @IsIP()
  ip: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  isOnline: boolean;

  @IsBoolean()
  snmpReachable: boolean;

  @ValidateNested()
  @Type(() => DeviceMetricsDto)
  metrics: DeviceMetricsDto;
}

export class ProbePayloadDto {
  @IsString()
  @IsNotEmpty()
  probeId: string;

  @IsISO8601()
  timestamp: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceDataDto)
  devices: DeviceDataDto[];
}
