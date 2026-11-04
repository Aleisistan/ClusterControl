import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateAlertConfigurationDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-40)
  @Max(100)
  temperatureLimit: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  humidityLimit: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(-40)
  @Max(100)
  temperatureRecoveryLimit?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(100)
  humidityRecoveryLimit?: number;

  @IsBoolean()
  @IsOptional()
  temperatureEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  humidityEnabled?: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients: string[];
}
