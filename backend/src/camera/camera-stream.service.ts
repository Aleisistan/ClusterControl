import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import type { Readable } from 'node:stream';

import { LoggerService } from '../common/logger/logger.service';

interface SharedCameraStream {
  clients: Set<Response>;
  blockedClients: Set<Response>;
  contentType?: string;
  source?: Readable;
  connection: Promise<void>;
}

@Injectable()
export class CameraStreamService {
  private readonly streams = new Map<string, SharedCameraStream>();

  constructor(private readonly logger: LoggerService) {}

  async stream(
    cameraId: number,
    streamUrl: string,
    response: Response,
  ): Promise<void> {
    const key = `${cameraId}:${streamUrl}`;
    let sharedStream = this.streams.get(key);

    if (!sharedStream) {
      sharedStream = this.createStream(key, streamUrl);
      this.streams.set(key, sharedStream);
    }

    this.setResponseHeaders(response);
    sharedStream.clients.add(response);
    if (sharedStream.contentType) {
      response.setHeader('Content-Type', sharedStream.contentType);
    }
    this.logger.log(
      `[CAMERA] Viewer conectado a cámara ${cameraId} ` +
      `(${sharedStream.clients.size} viewer(s))`,
    );
    response.on('close', () => {
      this.removeClient(key, sharedStream, response);
    });

    try {
      await sharedStream.connection;
    } catch (error) {
      this.removeClient(key, sharedStream, response);
      throw error;
    }
  }

  private createStream(
    key: string,
    streamUrl: string,
  ): SharedCameraStream {
    const sharedStream: SharedCameraStream = {
      clients: new Set(),
      blockedClients: new Set(),
      connection: Promise.resolve(),
    };

    sharedStream.connection = axios<Readable>({
      method: 'GET',
      url: streamUrl,
      responseType: 'stream',
      timeout: 10000,
    }).then(({ data, headers }) => {
      if (this.streams.get(key) !== sharedStream || sharedStream.clients.size === 0) {
        data.destroy();
        return;
      }

      const contentType = headers['content-type'];
      if (typeof contentType !== 'string' || !contentType) {
        data.destroy();
        throw new Error('La cámara no devolvió el encabezado Content-Type');
      }

      sharedStream.contentType = contentType;
      for (const client of sharedStream.clients) {
        client.setHeader('Content-Type', contentType);
      }

      sharedStream.source = data;
      this.logger.log(`[CAMERA] Conexión upstream activa para cámara ${key}`);
      data.on('data', (chunk: Buffer) => {
        this.broadcast(sharedStream, chunk);
      });
      data.on('end', () => {
        this.finishStream(key, sharedStream);
      });
      data.on('error', (error: Error) => {
        this.logger.error(
          `[CAMERA] Error en stream compartido ${key}: ${error.message}`,
        );
        this.finishStream(key, sharedStream);
      });
    });

    return sharedStream;
  }

  private broadcast(sharedStream: SharedCameraStream, chunk: Buffer): void {
    for (const client of sharedStream.clients) {
      if (client.destroyed || client.writableEnded) {
        this.removeClientFromStream(sharedStream, client);
        continue;
      }

      if (!client.write(chunk)) {
        sharedStream.blockedClients.add(client);
        client.once('drain', () => {
          sharedStream.blockedClients.delete(client);
          if (sharedStream.blockedClients.size === 0) {
            sharedStream.source?.resume();
          }
        });
      }
    }

    if (sharedStream.blockedClients.size > 0) {
      sharedStream.source?.pause();
    }
  }

  private removeClient(
    key: string,
    sharedStream: SharedCameraStream,
    client: Response,
  ): void {
    const wasConnected = sharedStream.clients.has(client);
    this.removeClientFromStream(sharedStream, client);

    if (wasConnected) {
      this.logger.log(
        `[CAMERA] Viewer desconectado de ${key} ` +
        `(${sharedStream.clients.size} viewer(s) restantes)`,
      );
    }

    if (sharedStream.clients.size === 0) {
      if (this.streams.get(key) === sharedStream) {
        this.streams.delete(key);
      }
      sharedStream.source?.destroy();
    }
  }

  private removeClientFromStream(
    sharedStream: SharedCameraStream,
    client: Response,
  ): void {
    sharedStream.clients.delete(client);
    sharedStream.blockedClients.delete(client);

    if (sharedStream.blockedClients.size === 0) {
      sharedStream.source?.resume();
    }
  }

  private finishStream(
    key: string,
    sharedStream: SharedCameraStream,
  ): void {
    if (this.streams.get(key) === sharedStream) {
      this.streams.delete(key);
    }

    for (const client of sharedStream.clients) {
      client.end();
    }
    sharedStream.clients.clear();
    sharedStream.blockedClients.clear();
  }

  private setResponseHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');
  }
}
