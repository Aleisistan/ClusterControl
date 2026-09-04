import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';
import axios from 'axios';

import { CameraService } from './camera.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { LoggerService } from '../common/logger/logger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('camera')
@UseGuards(JwtAuthGuard)
export class CameraController {
  constructor(
    private readonly cameraService: CameraService,
    private readonly logger: LoggerService,
  ) {}

  // =====================================================
  // CRUD
  // =====================================================

  @Get()
  findAll() {
    return this.cameraService.findAll();
  }

  @Get(':id')
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
  async stream(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Res() res: Response,
  ) {
    try {
      // Buscar todas las cámaras
      const cameras = await this.cameraService.findAll();

      // Buscar la cámara correspondiente al cluster
      const camera = cameras.find(
        (item) => item.cluster?.id === clusterId,
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

      // Limpiar IP por si accidentalmente tiene http://
      const cleanIp = camera.ip
        .replace(/^https?:\/\//, '')
        .split('/')[0];

      const streamUrl =
        `http://${cleanIp}:81/stream`;

      this.logger.log(
        `[CAMERA] Cluster ${clusterId} → ${streamUrl}`,
      );

      // Conectar con ESP32-CAM
      const cameraStream = await axios({
        method: 'GET',
        url: streamUrl,
        responseType: 'stream',
        timeout: 10000,
      });

      // Headers del stream
      res.setHeader(
        'Content-Type',
        'multipart/x-mixed-replace; boundary=frame',
      );

      res.setHeader(
        'Cache-Control',
        'no-cache',
      );

      res.setHeader(
        'Connection',
        'keep-alive',
      );

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*',
      );

      // Si el navegador cierra la conexión,
      // cerrar también la conexión con la cámara
      res.on('close', () => {
        cameraStream.data.destroy();
      });

      // Pasar el stream de la cámara directamente
      // al navegador
      cameraStream.data.pipe(res);

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

  // =====================================================
  // CAPTURE JPG
  // =====================================================

  @Get('capture/:clusterId')
  async capture(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Res() res: Response,
  ) {
    try {
      const cameras = await this.cameraService.findAll();

      const camera = cameras.find(
        (item) => item.cluster?.id === clusterId,
      );

      if (!camera || !camera.ip) {
        return res
          .status(404)
          .send('Cámara no encontrada');
      }

      const cleanIp = camera.ip
        .replace(/^https?:\/\//, '')
        .split('/')[0];

      const captureUrl =
        `http://${cleanIp}:81/capture`;

      this.logger.log(
        `[CAMERA] Capture cluster ${clusterId} → ${captureUrl}`,
      );

      const image = await axios({
        method: 'GET',
        url: captureUrl,
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      res.setHeader(
        'Content-Type',
        'image/jpeg',
      );

      res.send(image.data);

    } catch (error) {

      this.logger.error(
        `[CAMERA] Error obteniendo captura cluster ${clusterId}`,
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