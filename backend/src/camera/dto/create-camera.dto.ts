import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
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
  @MaxLength(255)
  @Transform(({ value }) => normalizeCameraAddress(value))
  ip: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
