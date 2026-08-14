import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { JwtService } from '@nestjs/jwt';

import { LoggerService } from '../common/logger/logger.service';

import { TelemetryResponseDto } from './dto/telemetry-response.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TelemetryGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  /*handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token;

    if (!token) {
      this.logger.warn('Conexión WebSocket rechazada');

      client.disconnect();

      return;
    }

    try {
      this.jwtService.verify(token);

      this.logger.log('Cliente WebSocket autenticado');
    } catch {
      this.logger.warn('Conexión WebSocket rechazada');

      client.disconnect();
    }*/
  handleConnection(client: Socket): void {
    // Busca el token en auth, luego en headers y finalmente en query params
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization ||
      client.handshake.headers?.token ||
      (client.handshake.query?.token as string);

    //console.log('>>> Token capturado:', token);

    if (!token) {
      this.logger.warn('❌ Conexión rechazada: No se envió ningún token');
      client.disconnect();
      return;
    }

    try {
      // Si usas 'Bearer tu_token', limpia la palabra 'Bearer '
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      this.logger.debug('✅ Cliente autenticado correctamente');
      // Aquí validas tu token (ejemplo con JwtService)
      // const payload = this.jwtService.verify(cleanToken);

      //console.log('✅ Cliente autenticado correctamente');
    } catch (error) {
      //console.error('❌ Token inválido:', error.message);
      this.logger.warn('❌ Conexión rechazada: Token inválido');
      client.disconnect();
    }
  }

  sendTelemetry(data: any): void {
    const response = new TelemetryResponseDto(data);

    this.server.emit('telemetry', response);
  }
}
