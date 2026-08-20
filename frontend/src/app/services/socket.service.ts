import { Injectable } from '@angular/core';

import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  socket: Socket;

  constructor(private authService: AuthService) {

    this.socket = io(environment.apiUrl, {
      // 'auth' como función: socket.io la ejecuta en CADA intento de
      // conexión/reconexión, así que siempre manda el token más
      // reciente (importante porque este service es singleton y se
      // crea una sola vez al arrancar la app, antes de que exista login).
      auth: (cb) => {
        cb({ token: this.authService.getToken() });
      },
      // El upgrade a WebSocket puro está fallando en este entorno
      // (probablemente por un proxy/nginx que no soporta el upgrade
      // de protocolo correctamente), lo que provoca que el server
      // corte la conexión en loop. Forzamos long-polling únicamente
      // para evitar el intento de upgrade.
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('✅ SOCKET CONECTADO', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ SOCKET DESCONECTADO:', reason);

      // Cuando el SERVER es el que corta la conexión, el cliente
      // de socket.io NO reconecta solo. Hay que forzarlo.
      if (reason === 'io server disconnect') {
        console.log('Reconectando manualmente tras corte del servidor...');
        this.socket.connect();
      }
      // En otros casos (transporte caído, red, etc.) el cliente
      // ya reintenta solo gracias a la config de arriba.
    });

    this.socket.on('connect_error', (err) => {
      console.log('⚠️ ERROR DE CONEXION:', err.message);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('🔄 Intentando reconectar... intento', attempt);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('✅ RECONECTADO tras', attempt, 'intentos');
    });

    this.socket.on('reconnect_failed', () => {
      console.log('⚠️ Falló la reconexión definitivamente');
    });

  }

  /**
   * Se suscribe al evento 'telemetry'.
   * Devuelve una función para desuscribirse (usar en ngOnDestroy).
   */
  onTelemetry(callback: (data: any) => void): () => void {
    this.socket.on('telemetry', callback);
    return () => this.socket.off('telemetry', callback);
  }

  get connected(): boolean {
    return this.socket.connected;
  }

}