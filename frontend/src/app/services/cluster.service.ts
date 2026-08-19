import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ClusterRecord {
  id: number;
  name: string;
  location?: string | null;
  lat?: number | null;
  lon?: number | null;
  deviceId?: string | null;
  timezone?: string | null;
}

export interface ClusterPayload {
  name: string;
  location?: string | null;
  lat?: number | null;
  lon?: number | null;
  deviceId?: string | null;
  timezone?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ClusterService {
  private apiUrl = `${environment.apiUrl}/clusters`;

  constructor(private http: HttpClient) { }

  getClusters(): Observable<ClusterRecord[]> {
    return this.http.get<ClusterRecord[]>(this.apiUrl);
  }

  createCluster(payload: ClusterPayload): Observable<ClusterRecord> {
    return this.http.post<ClusterRecord>(this.apiUrl, payload);
  }

  updateCluster(id: number, payload: ClusterPayload): Observable<ClusterRecord> {
    return this.http.patch<ClusterRecord>(`${this.apiUrl}/${id}`, payload);
  }

  deleteCluster(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
