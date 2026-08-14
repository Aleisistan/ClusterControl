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
  async stream(@Res() res: Response) {
    const url = process.env.CAMERA_STREAM_URL;

    if (!url) {
      this.logger.error('CAMERA_STREAM_URL no está configurada');

      return res.status(500).send('Servicio de cámara no disponible');
    }

    try {
      const stream = await axios({
        method: 'get',
        url,
        responseType: 'stream',
      });

      res.setHeader(
        'Content-Type',
        'multipart/x-mixed-replace; boundary=frame',
      );

      stream.data.pipe(res);
    } catch (error) {
      this.logger.error('Error conectando con el stream de la cámara');

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
