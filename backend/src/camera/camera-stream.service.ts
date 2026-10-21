import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import type { Readable } from 'node:stream';

import { LoggerService } from '../common/logger/logger.service';

interface SharedCameraStream {
  clients: Set<Response>;
  blockedClients: Set<Response>;
  frameWaiters: Set<(frame: Buffer) => void>;
  contentType?: string;
  latestFrame?: Buffer;
  pendingFrameData: Buffer;
  source?: Readable;
  connection: Promise<void>;
}

@Injectable()
export class CameraStreamService {
  private static readonly MAX_PENDING_FRAME_BYTES = 10 * 1024 * 1024;
  private static readonly JPEG_START = Buffer.from([0xff, 0xd8]);
  private static readonly JPEG_END = Buffer.from([0xff, 0xd9]);
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

  async getLatestFrame(
    cameraId: number,
    streamUrl: string,
    timeoutMs = 3000,
  ): Promise<Buffer | null> {
    const key = `${cameraId}:${streamUrl}`;
    const sharedStream = this.streams.get(key);
    if (!sharedStream) return null;
    if (sharedStream.latestFrame) return sharedStream.latestFrame;

    return new Promise((resolve) => {
      const onFrame = (frame: Buffer) => {
        clearTimeout(timeout);
        sharedStream.frameWaiters.delete(onFrame);
        resolve(frame);
      };
      const timeout = setTimeout(() => {
        sharedStream.frameWaiters.delete(onFrame);
        resolve(null);
      }, timeoutMs);

      sharedStream.frameWaiters.add(onFrame);
    });
  }

  isStreaming(cameraId: number, streamUrl: string): boolean {
    return this.streams.has(`${cameraId}:${streamUrl}`);
  }

  private createStream(
    key: string,
    streamUrl: string,
  ): SharedCameraStream {
    const sharedStream: SharedCameraStream = {
      clients: new Set(),
      blockedClients: new Set(),
      frameWaiters: new Set(),
      pendingFrameData: Buffer.alloc(0),
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
        this.updateLatestFrame(sharedStream, chunk);
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

  private updateLatestFrame(
    sharedStream: SharedCameraStream,
    chunk: Buffer,
  ): void {
    const data = Buffer.concat([sharedStream.pendingFrameData, chunk]);
    let searchFrom = 0;

    while (searchFrom < data.length) {
      const start = data.indexOf(CameraStreamService.JPEG_START, searchFrom);
      if (start === -1) {
        sharedStream.pendingFrameData =
          data[data.length - 1] === 0xff ? data.subarray(-1) : Buffer.alloc(0);
        return;
      }

      const end = data.indexOf(CameraStreamService.JPEG_END, start + 2);
      if (end === -1) {
        const pendingFrameData = data.subarray(start);
        sharedStream.pendingFrameData =
          pendingFrameData.length <= CameraStreamService.MAX_PENDING_FRAME_BYTES
            ? pendingFrameData
            : Buffer.alloc(0);
        return;
      }

      const frame = Buffer.from(data.subarray(start, end + 2));
      sharedStream.latestFrame = frame;
      for (const resolveFrame of sharedStream.frameWaiters) {
        resolveFrame(frame);
      }
      searchFrom = end + 2;
    }

    sharedStream.pendingFrameData = Buffer.alloc(0);
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
