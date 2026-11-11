import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface CameraRecord {
  id: number;
  name: string;
  ip: string;
}

export interface CameraPayload {
  name: string;
  ip: string;
  deviceId: string;
}

export interface CameraUpdatePayload {
  name: string;
  ip: string;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private readonly apiUrl = `${environment.apiUrl}/camera`;

  constructor(private readonly http: HttpClient) {}

  createCamera(payload: CameraPayload): Observable<CameraRecord> {
    return this.http.post<CameraRecord>(this.apiUrl, payload);
  }

  updateCamera(
    id: number,
    payload: CameraUpdatePayload,
  ): Observable<CameraRecord> {
    return this.http.patch<CameraRecord>(`${this.apiUrl}/${id}`, payload);
  }

  deleteCamera(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
