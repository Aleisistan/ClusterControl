import {
    WebSocketGateway,
    WebSocketServer
} from '@nestjs/websockets';

import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class TelemetryGateway {

  @WebSocketServer()
  server!: Server;

  sendTelemetry(data: any) {console.log(
    'EMITIENDO WS:',
    data.cluster?.id
  );

  this.server.emit(
    'telemetry',
    data
  );
  }}