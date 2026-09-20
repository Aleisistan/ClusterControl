import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {

 private apiUrl = `${environment.apiUrl}/telemetry`;

  constructor(
    private http: HttpClient
  ) {}

  getHistory(
    clusterId: number,
    options?: { from?: string; to?: string; limit?: number },
  ) {
    let params = new HttpParams().set('clusterId', clusterId);

    if (options?.from) params = params.set('from', options.from);
    if (options?.to) params = params.set('to', options.to);
    if (options?.limit) params = params.set('limit', options.limit);

    return this.http.get(`${this.apiUrl}/history`, { params });
  }

  getLatest(clusterId: number) {

    return this.http.get(
    `${this.apiUrl}/latest?clusterId=${clusterId}`
  );
  

}
}