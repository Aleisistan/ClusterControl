import { Injectable } from '@angular/core';

import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  socket: Socket;

  constructor() {

    this.socket = io(environment.apiUrl);

  }

  onTelemetry(callback: any) {

    this.socket.on('telemetry', callback);

  }

}