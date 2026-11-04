import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNumber,
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

  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients: string[];
}
