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

export interface IndustrialTestStatus {
  state: 'idle' | 'running' | 'completed' | 'interrupted' | 'unknown' | 'failed';
  active: boolean;
  started_at?: string;
  updated_at?: string;
  run_directory?: string;
  requested_hours?: number | null;
  interval_seconds?: number;
  current_cycle?: number;
  completed_cycles?: number;
  passed_cycles?: number;
  failed_cycles?: number;
  totals?: {
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
  };
  failed_tests?: string[];
  cycle_history?: IndustrialTestCycle[];
  last_cycle_status?: 'passed' | 'failed' | null;
  finished_at?: string;
}

export interface IndustrialTestCycle {
  cycle: number;
  started_at: string;
  duration_seconds: number;
  status: 'passed' | 'failed';
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  failed_tests: string[];
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
    options?: {
      from?: string;
      to?: string;
      limit?: number;
      source?: 'device' | 'industrial-test';
    },
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

  getLatestDevice(clusterId: number) {
    return this.http.get<any>(`${this.apiUrl}/latest-device`, {
      params: new HttpParams().set('clusterId', clusterId),
    });
  }

  getIndustrialTestStatus() {
    return this.http.get<IndustrialTestStatus>(
      `${environment.apiUrl}/industrial-tests/status`,
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
    options?: {
      from?: string;
      to?: string;
      limit?: number;
      source?: 'device' | 'industrial-test';
    },
  ): HttpParams {
    let params = new HttpParams().set('clusterId', clusterId);

    if (options?.from) params = params.set('from', options.from);
    if (options?.to) params = params.set('to', options.to);
    if (options?.limit) params = params.set('limit', options.limit);
    if (options?.source) params = params.set('source', options.source);

    return params;
  }
}