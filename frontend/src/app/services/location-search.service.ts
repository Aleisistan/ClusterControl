import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable, map } from 'rxjs';

interface OpenMeteoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoLocation[];
}

export interface LocationSearchResult {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationSearchService {
  private readonly apiUrl = 'https://geocoding-api.open-meteo.com/v1/search';

  constructor(private readonly http: HttpClient) {}

  search(query: string): Observable<LocationSearchResult[]> {
    const params = new HttpParams()
      .set('name', query)
      .set('count', '10')
      .set('language', 'es')
      .set('format', 'json');

    return this.http.get<OpenMeteoGeocodingResponse>(this.apiUrl, { params }).pipe(
      map((response) =>
        (response.results || [])
          .filter((location) => Boolean(location.timezone))
          .map((location) => ({
            id: location.id,
            label: [location.name, location.admin1, location.country]
              .filter(Boolean)
              .join(', '),
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone as string,
          })),
      ),
    );
  }
}
