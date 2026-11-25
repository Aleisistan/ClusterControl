import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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
  @MaxLength(2048)
  @Transform(({ value }) => normalizeCameraAddress(value))
  ip?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  slot?: number;
}
