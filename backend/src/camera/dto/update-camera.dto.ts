import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  IsCameraAddress,
  normalizeCameraAddress,
} from './normalize-camera-address';

export class UpdateCameraDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsCameraAddress()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => normalizeCameraAddress(value))
  ip?: string;
}
