import {
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class UpdateClusterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
