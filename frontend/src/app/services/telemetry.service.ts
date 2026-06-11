import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {

 private apiUrl = `${environment.apiUrl}/telemetry`;

  constructor(
    private http: HttpClient
  ) {}

  getHistory(clusterId: number) {

    return this.http.get(
    `${this.apiUrl}/history?clusterId=${clusterId}`
    );
  }

  getLatest(clusterId: number) {

    return this.http.get(
    `${this.apiUrl}/latest?clusterId=${clusterId}`
  );
  

}
}