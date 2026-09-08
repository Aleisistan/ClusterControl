import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class WeatherService {
  private readonly apiKey = process.env['OPENWEATHER_API_KEY'] || '';

  async getCurrentWeather(lat: number, lon: number): Promise<any> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Falló la consulta de clima actual');
      return await response.json();
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener el clima actual');
    }
  }

  async getForecast(lat: number, lon: number): Promise<any> {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Falló la consulta del pronóstico');
      return await response.json();
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener el pronóstico');
    }
  }
}