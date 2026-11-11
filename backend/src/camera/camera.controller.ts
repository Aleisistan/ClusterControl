import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { isIP } from 'node:net';

import type { Response } from 'express';

import { CameraService } from './camera.service';
import { CameraStreamService } from './camera-stream.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { LoggerService } from '../common/logger/logger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CameraStreamAuthGuard } from './guards/camera-stream-auth.guard';

@Controller('camera')
export class CameraController {
  constructor(
    private readonly cameraService: CameraService,
    private readonly cameraStreamService: CameraStreamService,
    private readonly logger: LoggerService,
  ) {}

  // =====================================================
  // CRUD
  // =====================================================

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.cameraService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cameraService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(
    @Body() data: CreateCameraDto,
  ) {
    return this.cameraService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCameraDto,
  ) {
    return this.cameraService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  delete(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cameraService.delete(id);
  }

  // =====================================================
  // STREAM DE CÁMARA POR CLUSTER
  // =====================================================

  @Get('stream/:clusterId')
  @UseGuards(CameraStreamAuthGuard)
  async stream(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Query('cameraId') cameraIdParam: string | undefined,
    @Query('resource') resource: string | undefined,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    try {
      // Buscar todas las cámaras
      const cameras = await this.cameraService.findAll();

      // Buscar la cámara correspondiente al cluster
      const requestedCameraId = cameraIdParam ? Number(cameraIdParam) : undefined;
      const camera = cameras.find(
        (item) =>
          item.cluster?.id === clusterId &&
          (requestedCameraId === undefined || item.id === requestedCameraId),
      );

      if (!camera) {
        this.logger.warn(
          `[CAMERA] No existe cámara para cluster ${clusterId}`,
        );

        return res
          .status(404)
          .send('Cámara no encontrada');
      }

      if (!camera.ip) {
        this.logger.warn(
          `[CAMERA] Cámara ${camera.id} no tiene IP`,
        );

        return res
          .status(404)
          .send('IP de cámara no configurada');
      }

      let streamUrl: URL;
      if (/^https?:\/\//i.test(camera.ip)) {
        try {
          streamUrl = new URL(camera.ip);
        } catch {
          return res.status(400).send('URL de cámara no válida');
        }
      } else {
        const ipVersion = isIP(camera.ip);
        if (!ipVersion) {
          this.logger.warn(
            `[CAMERA] La cámara ${camera.id} tiene un hostname sin URL completa`,
          );
          return res
            .status(400)
            .send(
              'La dirección guardada no es una IP ni una URL completa. ' +
                'Actualízala desde Clusters con la URL completa del stream.',
            );
        }

        const host = ipVersion === 6 ? `[${camera.ip}]` : camera.ip;
        streamUrl = new URL(`http://${host}:81/stream`);
      }

      const hostname = streamUrl.hostname.replace(/^\[|\]$/g, '');
      const isIpCamera = isIP(hostname) !== 0;
      if (
        !['http:', 'https:'].includes(streamUrl.protocol) ||
        !streamUrl.hostname ||
        streamUrl.username ||
        streamUrl.password
      ) {
        return res.status(400).send('URL de cámara no válida');
      }

      if (!isIpCamera) {
        if (resource) {
          return res.status(400).send('El stream de esta cámara no admite proxy HLS');
        }
        this.logger.log(
          `[CAMERA] Redirigiendo cluster ${clusterId} al origen configurado`,
        );
        return res.redirect(streamUrl.toString());
      }

      if (resource) {
        let resourceUrl: URL;
        try {
          resourceUrl = new URL(resource);
        } catch {
          return res.status(400).send('Recurso HLS no válido');
        }

        if (
          resourceUrl.origin !== streamUrl.origin ||
          !['http:', 'https:'].includes(resourceUrl.protocol) ||
          resourceUrl.username ||
          resourceUrl.password
        ) {
          return res.status(400).send('El recurso HLS debe pertenecer al origen configurado');
        }

        await this.proxyHlsResource(
          resourceUrl,
          streamUrl.origin,
          clusterId,
          camera.id,
          token,
          res,
        );
        return;
      }

      if (/\.m3u8$/i.test(streamUrl.pathname)) {
        await this.proxyHlsResource(
          streamUrl,
          streamUrl.origin,
          clusterId,
          camera.id,
          token,
          res,
        );
        return;
      }

      this.logger.log(
        `[CAMERA] Relay para cluster ${clusterId}, cámara ${camera.id}`,
      );
      await this.cameraStreamService.stream(camera.id, streamUrl.toString(), res);

    } catch (error) {
      this.logger.error(
        `[CAMERA] Error conectando cluster ${clusterId}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      if (!res.headersSent) {
        return res
          .status(502)
          .send(
            'Servicio de cámara no disponible',
          );
      }

      res.end();
    }
  }

  private async proxyHlsResource(
    resourceUrl: URL,
    allowedOrigin: string,
    clusterId: number,
    cameraId: number,
    token: string | undefined,
    response: Response,
  ): Promise<void> {
    const isPlaylist = /\.m3u8$/i.test(resourceUrl.pathname);
    const result = await axios.get(
      resourceUrl.toString(),
      {
        responseType: isPlaylist ? 'arraybuffer' : 'stream',
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 10 * 1024 * 1024,
      },
    );

    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Access-Control-Allow-Origin', '*');

    if (!isPlaylist) {
      const contentType = result.headers['content-type'];
      response.setHeader(
        'Content-Type',
        typeof contentType === 'string'
          ? contentType
          : 'application/octet-stream',
      );
      const source = result.data as NodeJS.ReadableStream;
      source.on('error', (error: Error) => {
        this.logger.error(
          `[CAMERA] Error retransmitiendo recurso HLS de cluster ${clusterId}: ${error.message}`,
        );
        response.end();
      });
      source.pipe(response);
      return;
    }

    const playlist = Buffer.from(result.data as ArrayBuffer).toString('utf8');
    const makeProxyUrl = (uri: string): string => {
      const target = new URL(uri, resourceUrl);
      if (
        target.origin !== allowedOrigin ||
        target.username ||
        target.password
      ) {
        throw new Error('La playlist HLS referencia un origen no permitido');
      }

      const query = new URLSearchParams({
        cameraId: String(cameraId),
        resource: target.toString(),
      });
      if (token) query.set('token', token);
      return `?${query.toString()}`;
    };
    const rewrittenPlaylist = playlist
      .replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        return `URI="${makeProxyUrl(uri)}"`;
      })
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#')
          ? makeProxyUrl(trimmed)
          : line;
      })
      .join('\n');

    const contentType = result.headers['content-type'];
    response.setHeader(
      'Content-Type',
      typeof contentType === 'string'
        ? contentType
        : 'application/vnd.apple.mpegurl',
    );
    response.send(rewrittenPlaylist);
  }

  // =====================================================
  // CAPTURE JPG
  // =====================================================

  @Get('capture/:clusterId')
  @UseGuards(JwtAuthGuard)
  async capture(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Res() res: Response,
  ) {
    try {
      const image = await this.cameraService.captureForCluster(clusterId);

      res.setHeader(
        'Content-Type',
        'image/jpeg',
      );

      res.send(image);

    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(error.getStatus()).send(error.message);
      }

      this.logger.error(
        `[CAMERA] Error obteniendo captura cluster ${clusterId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (!res.headersSent) {
        return res
          .status(502)
          .send(
            'Captura de cámara no disponible',
          );
      }

      res.end();
    }
  }
}