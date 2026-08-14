import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  role?: string;
}
