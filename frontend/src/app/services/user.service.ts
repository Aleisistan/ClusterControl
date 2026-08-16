import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface UserRecord {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

export interface UserPayload {
  username: string;
  password?: string;
  role: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(this.apiUrl);
  }

  createUser(payload: UserPayload): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.apiUrl, payload);
  }

  updateUser(id: number, payload: UserPayload): Observable<UserRecord> {
    return this.http.patch<UserRecord>(`${this.apiUrl}/${id}`, payload);
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}