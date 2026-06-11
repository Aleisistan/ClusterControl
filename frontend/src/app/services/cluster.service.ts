import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClusterService {
  private apiUrl = `${environment.apiUrl}/clusters`;

  constructor(private http: HttpClient) { }

  getClusters() {
    return this.http.get(this.apiUrl);
  }
}
