import { IsIP, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCameraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsIP()
  @IsNotEmpty()
  ip: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
