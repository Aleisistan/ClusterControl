import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CameraService {

  private apiUrl =
    `${environment.apiUrl}/camera`;

  constructor(
    private http: HttpClient
  ) {}

  getCameraIp() {
    return this.http.get<any>(
      `${this.apiUrl}/ip`
    );
  }
}