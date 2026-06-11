import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {

  private apiKey = '7fc00f7fb26ceaf9f7c803831589bf9e';

  constructor(
    private http: HttpClient
  ) {}

  getWeather(lat: number, lon: number) {

    return this.http.get(

      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`

    );

  }

  getForecast(lat: number, lon: number) {

    return this.http.get(

      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=es`

    );

  }

}