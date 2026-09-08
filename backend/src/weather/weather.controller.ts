import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  // GET /weather?lat=X&lon=Y
  @Get()
  async getWeather(@Query('lat') lat: string, @Query('lon') lon: string) {
    if (!lat || !lon) throw new BadRequestException('Latitud y longitud requeridas');
    return this.weatherService.getCurrentWeather(Number(lat), Number(lon));
  }

  // GET /weather/forecast?lat=X&lon=Y
  @Get('forecast')
  async getForecast(@Query('lat') lat: string, @Query('lon') lon: string) {
    if (!lat || !lon) throw new BadRequestException('Latitud y longitud requeridas');
    return this.weatherService.getForecast(Number(lat), Number(lon));
  }
}