import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {

  private readonly apiUrl = `${environment.apiUrl}/weather`;

  constructor(
    private http: HttpClient
  ) {}

  getWeather(lat: number, lon: number) {
    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon);

    return this.http.get(this.apiUrl, { params });
  }

  getForecast(lat: number, lon: number) {
    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon);

    return this.http.get(`${this.apiUrl}/forecast`, { params });

  }

}