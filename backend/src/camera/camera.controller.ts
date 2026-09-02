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
  ) {@Get('stream/:clusterId')
async stream(
  @Param('clusterId', ParseIntPipe) clusterId: number,
  @Res() res: Response,
) {
  try {
    const url = await this.cameraService.getStreamUrl(clusterId);

    this.logger.log(
      `[CAMERA] Conectando stream cluster ${clusterId}: ${url}`,
    );

    const stream = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 10000,
    });

    res.setHeader(
      'Content-Type',
      'multipart/x-mixed-replace; boundary=frame',
    );

    stream.data.pipe(res);

    stream.data.on('error', (error: Error) => {
      this.logger.error(
        `[CAMERA] Error en stream cluster ${clusterId}: ${error.message}`,
      );

      if (!res.headersSent) {
        res
          .status(502)
          .send('Stream de cámara no disponible');
      } else {
        res.end();
      }
    });
  } catch (error) {
    this.logger.error(
      `[CAMERA] Error conectando cluster ${clusterId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    if (!res.headersSent) {
      return res
        .status(502)
        .send('Servicio de cámara no disponible');
    }

    res.end();
  }
}}

  // =========================
  // CRUD
  // =========================

  @Get()
  findAll() {
    return this.cameraService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.cameraService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() data: CreateCameraDto) {
    return this.cameraService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateCameraDto) {
    return this.cameraService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.cameraService.delete(id);
  }

  // =========================
  // STREAM
  // =========================

  @Get('stream')
  async stream(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Res() res: Response,
  ) {
    // 1. Buscar el registro de la cámara asociado al cluster en la base de datos
    const cameras = await this.cameraService.findAll();
    const camera = cameras.find((item) => item.cluster?.id === clusterId);

    if (!camera || !camera.ip) {
      this.logger.error(`No existe cámara o IP registrada para el cluster ${clusterId}`);
      return res.status(404).send('Cámara no encontrada');
    }

    // 2. Construir la URL con la IP actual en la BD
    const cleanIp = camera.ip.replace(/^https?:\/\//, '').split('/')[0];
    const streamUrl = `http://${cleanIp}:81/stream`;

    try {
      const stream = await axios({
        method: 'get',
        url: streamUrl,
        responseType: 'stream',
        timeout: 5000,
      });
      // Encabezados necesarios para evitar OpaqueResponseBlocking (ORB) y CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader(
      'Content-Type',
      'multipart/x-mixed-replace; boundary=frame',
    );

      res.setHeader(
        'Content-Type',
        'multipart/x-mixed-replace; boundary=frame',
      );

      res.on('close', () => {
        stream.data.destroy();
      });

      stream.data.pipe(res);
    } catch (error) {
      this.logger.error(`Error conectando con el stream en ${streamUrl}`);
      return res.status(502).send('Servicio de cámara no disponible');
    }
  }


  // =========================
  // CAPTURE JPG
  // =========================

  @Get('capture')
  async capture(@Res() res: Response) {
    const url = process.env.CAMERA_CAPTURE_URL;

    if (!url) {
      this.logger.error('CAMERA_CAPTURE_URL no está configurada');

      return res.status(500).send('Servicio de cámara no disponible');
    }

    try {
      const image = await axios({
        method: 'get',
        url,
        responseType: 'arraybuffer',
      });

      res.setHeader('Content-Type', 'image/jpeg');

      res.send(image.data);
    } catch (error) {
      this.logger.error('Error obteniendo captura de la cámara');

      return res.status(502).send('Servicio de cámara no disponible');
    }
  }
}
