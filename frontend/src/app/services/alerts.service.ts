import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface AlertConfiguration {
  temperatureLimit: number;
  humidityLimit: number;
  temperatureRecoveryLimit?: number;
  humidityRecoveryLimit?: number;
  temperatureEnabled: boolean;
  humidityEnabled: boolean;
  recipients: string[];
  smtpConfigured: boolean;
}

export interface AlertConfigurationUpdate {
  temperatureLimit: number;
  humidityLimit: number;
  temperatureRecoveryLimit?: number;
  humidityRecoveryLimit?: number;
  temperatureEnabled: boolean;
  humidityEnabled: boolean;
  recipients: string[];
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly apiUrl = `${environment.apiUrl}/alerts`;

  constructor(private readonly http: HttpClient) {}

  getConfiguration(clusterId: number): Observable<AlertConfiguration> {
    return this.http.get<AlertConfiguration>(
      `${this.apiUrl}/configuration/${clusterId}`,
    );
  }

  updateConfiguration(
    clusterId: number,
    configuration: AlertConfigurationUpdate,
  ): Observable<AlertConfiguration> {
    return this.http.patch<AlertConfiguration>(
      `${this.apiUrl}/configuration/${clusterId}`,
      configuration,
    );
  }

  sendTestEmail(clusterId: number): Observable<{ sent: true }> {
    return this.http.post<{ sent: true }>(
      `${this.apiUrl}/test-email/${clusterId}`,
      {},
    );
  }
}
