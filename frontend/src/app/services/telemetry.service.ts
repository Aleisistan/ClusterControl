import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface TelemetryStateHistoryEntry {
  id: number;
  eventType: 'state-change';
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

export interface TelemetryOutageHistoryEntry {
  id: string;
  eventType: 'disconnect';
  createdAt: string;
  startedAt: string;
  endedAt: string;
}

export interface CameraStateHistoryEntry {
  id: string;
  eventType: 'camera-state-change';
  createdAt: string;
  cameraName: string;
  from: 'Activa' | 'Inactiva';
  to: 'Activa' | 'Inactiva';
}

export interface DoorSnapshotHistoryEntry {
  id: string;
  eventType: 'door-snapshot';
  snapshotId: number;
  telemetryId: number;
  createdAt: string;
}

export type TelemetryHistoryEntry =
  | TelemetryStateHistoryEntry
  | TelemetryOutageHistoryEntry
  | CameraStateHistoryEntry
  | DoorSnapshotHistoryEntry;

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
    return this.http.get<TelemetryHistoryEntry[]>(
      `${this.apiUrl}/state-history`,
      { params: this.createHistoryParams(clusterId, options) },
    );
  }

  getLatest(clusterId: number) {
    return this.http.get(
      `${this.apiUrl}/latest?clusterId=${clusterId}`
    );
  }

  getDoorSnapshotImage(snapshotId: number) {
    return this.http.get(
      `${this.apiUrl}/door-snapshots/${snapshotId}/image`,
      { responseType: 'blob' },
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