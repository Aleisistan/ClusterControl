import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  constructor(private http: HttpClient) {}

  getCameraIp(clusterId: number): Observable<any> {
    const token = localStorage.getItem('acces_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const params = new HttpParams().set('clusterId', clusterId.toString());
    return this.http.get<any>(`${environment.apiUrl}/camera/ip`, { params });
  }
}