import { IsBoolean, IsNumber, IsInt } from 'class-validator';

export class TelemetryPayload {
  @IsInt()
  deviceId: number;

  @IsNumber()
  temp1: number;

  @IsNumber()
  temp2: number;

  @IsNumber()
  hum1: number;

  @IsNumber()
  hum2: number;

  @IsBoolean()
  extractor: boolean;

  @IsBoolean()
  aire: boolean;

  @IsBoolean()
  puerta: boolean;
}
