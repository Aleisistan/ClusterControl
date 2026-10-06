import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface TelemetryStateHistoryEntry {
  id: number;
  createdAt: string;
  temperature1: number;
  temperature2: number;
  humidity1: number;
  humidity2: number;
  extractor: boolean;
  aire: boolean;
  puerta: boolean;
  luzEncendida: boolean;
  previousExtractor: boolean;
  previousAire: boolean;
  previousPuerta: boolean;
  previousLuzEncendida: boolean;
}

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
    return this.http.get(`${this.apiUrl}/history`, {
      params: this.createHistoryParams(clusterId, options),
    });
  }

  getStateHistory(
    clusterId: number,
    options?: { from?: string; to?: string; limit?: number },
  ) {
    return this.http.get<TelemetryStateHistoryEntry[]>(
      `${this.apiUrl}/state-history`,
      { params: this.createHistoryParams(clusterId, options) },
    );
  }

  getLatest(clusterId: number) {
    return this.http.get(
      `${this.apiUrl}/latest?clusterId=${clusterId}`
    );
  }

  private createHistoryParams(
    clusterId: number,
    options?: { from?: string; to?: string; limit?: number },
  ): HttpParams {
    let params = new HttpParams().set('clusterId', clusterId);

    if (options?.from) params = params.set('from', options.from);
    if (options?.to) params = params.set('to', options.to);
    if (options?.limit) params = params.set('limit', options.limit);

    return params;
  }
}