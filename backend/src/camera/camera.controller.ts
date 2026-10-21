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
  NotFoundException,
} from '@nestjs/common';

import type { Response } from 'express';

import { CameraService } from './camera.service';
import { CameraStreamService } from './camera-stream.service';
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
    private readonly cameraStreamService: CameraStreamService,
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

      await this.cameraStreamService.stream(camera.id, streamUrl, res);

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