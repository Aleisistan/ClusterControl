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

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string' || token.length === 0) {
      this.logger.warn('Conexión rechazada: no se envió ningún token');
      client.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token);
      this.logger.debug('Cliente autenticado correctamente');
    } catch {
      this.logger.warn('Conexión rechazada: token inválido');
      client.disconnect();
    }
  }

  sendTelemetry(data: any): void {
    const response = new TelemetryResponseDto(data);

    this.server.emit('telemetry', response);
  }

  sendDoorSnapshot(data: {
    clusterId: number;
    snapshotId: number;
    telemetryId: number;
    createdAt: Date;
  }): void {
    this.server.emit('door-snapshot', data);
  }
}
