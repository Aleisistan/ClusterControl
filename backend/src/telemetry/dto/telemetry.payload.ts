import { IsBoolean, IsNumber, IsInt, Min, Max } from 'class-validator';

export class TelemetryPayload {
  @IsNumber()
  deviceId: number;

  @IsNumber()
  @Min(-40)
  @Max(100)
  temp1: number;

  @IsNumber()
  @Min(-40)
  @Max(100) 
  temp2: number;

  @IsNumber()
  @Min(0)
  @Max(100) 
  hum1: number;

  @IsNumber() 
  @Min(0)
  @Max(100)
  hum2: number;

  @IsBoolean()
  extractor: boolean;

  @IsBoolean()
  aire: boolean;

  @IsBoolean()
  puerta: boolean;
}
