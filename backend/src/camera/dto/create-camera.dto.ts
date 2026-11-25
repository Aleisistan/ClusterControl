import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  IsCameraAddress,
  normalizeCameraAddress,
} from './normalize-camera-address';

export class CreateCameraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsCameraAddress()
  @IsNotEmpty()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => normalizeCameraAddress(value))
  ip: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  slot: number;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
