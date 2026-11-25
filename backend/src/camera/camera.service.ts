import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { isIP } from 'node:net';

import { LoggerService } from '../common/logger/logger.service';

import { CameraPayload } from './dto/camera.payload';
import { CameraRepository } from './repositories/camera.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { CameraStreamService } from './camera-stream.service';

import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Injectable()
export class CameraService {
  private cameraIp = '';

  constructor(
    private readonly logger: LoggerService,
    private readonly cameraRepository: CameraRepository,
    private readonly clusterRepository: ClusterRepository,
    private readonly cameraStreamService: CameraStreamService,
  ) {}

  setCameraIp(ip: string): void {
    this.cameraIp = ip;

    this.logger.log(`CAMARA IP ACTUALIZADA: ${ip}`);
  }

  getCameraIp(): string {
    return this.cameraIp;
  }

  async updateFromMqtt(data: CameraPayload): Promise<void> {
    const deviceId = String(data.deviceId).trim();
    const numericId = Number(deviceId);
    const cluster = await this.clusterRepository.findByDeviceId(deviceId)
      ?? (Number.isInteger(numericId)
        ? await this.clusterRepository.findById(numericId)
        : null);
    const camera = await this.cameraRepository.findByDeviceId(deviceId)
      ?? (cluster
        ? await this.cameraRepository.findByClusterId(cluster.id)
        : null);

    if (!camera) {
      if (!cluster) {
        this.logger.warn(
          `No existe cluster para la cámara ${deviceId} ` +
          `(se esperaba deviceId MQTT o ID interno del cluster)`,
        );
        return;
      }

      const clusterCameras = await this.cameraRepository.findAllByClusterId(cluster.id);
      if (clusterCameras.length >= 2) {
        this.logger.warn(
          `No se puede registrar una tercera cámara para el cluster ${cluster.id}`,
        );
        return;
      }

      const newCamera = this.cameraRepository.create({
        name: `Cámara ${cluster.name}`,
        ip: data.ip,
        cluster,
        lastSeen: new Date(),
        status: true,
      });

      await this.cameraRepository.save(newCamera);
      this.cameraIp = data.ip;
      this.logger.log(`Cámara creada para el cluster ${cluster.id}`);

      return;
    }

    camera.ip = data.ip;
    camera.lastSeen = new Date();
    camera.status = true;

    await this.cameraRepository.save(camera);

    this.cameraIp = data.ip;

    this.logger.log(`Cámara ${camera.id} actualizada desde MQTT`);
  }

  async findAll() {
    return this.cameraRepository.findAll();
  }

  async findById(id: number) {
    const camera = await this.cameraRepository.findById(id);

    if (!camera) {
      throw new NotFoundException('Cámara no encontrada');
    }

    return camera;
  }

  async create(data: CreateCameraDto) {
    const cluster = await this.clusterRepository.findByDeviceId(data.deviceId);

    if (!cluster) {
      throw new NotFoundException('Cluster no encontrado');
    }

    const clusterCameras = await this.cameraRepository.findAllByClusterId(cluster.id);
    if (clusterCameras.length >= 2) {
      this.logger.warn(
        `Intento de crear una tercera cámara para cluster ${data.deviceId}`,
      );

      throw new ConflictException('El cluster ya tiene el máximo de 2 cámaras');
    }

    const existingAddress = await this.cameraRepository.findByIp(data.ip);
    if (existingAddress) {
      throw new ConflictException('La dirección ya está asignada a otra cámara');
    }

    const camera = this.cameraRepository.create({
      name: data.name,
      ip: data.ip,
      cluster,
    });

    const savedCamera = await this.cameraRepository.save(camera);

    this.logger.log(
      `Cámara ${savedCamera.id} creada para cluster ${data.deviceId}`,
    );

    return savedCamera;
  }

  async update(id: number, data: UpdateCameraDto) {
    const camera = await this.cameraRepository.findById(id);

    if (!camera) {
      throw new NotFoundException('Cámara no encontrada');
    }

    if (data.name !== undefined) {
      camera.name = data.name;
    }

    if (data.ip !== undefined) {
      const existingIp = await this.cameraRepository.findByIp(data.ip);
      if (existingIp && existingIp.id !== camera.id) {
        throw new ConflictException('La IP ya está asignada a otra cámara');
      }

      camera.ip = data.ip;
    }

    const updatedCamera = await this.cameraRepository.save(camera);

    this.logger.log(`Cámara ${id} actualizada`);

    return updatedCamera;
  }

  async delete(id: number): Promise<void> {
    const camera = await this.cameraRepository.findById(id);

    if (!camera) {
      throw new NotFoundException('Cámara no encontrada');
    }

    await this.cameraRepository.delete(id);

    this.logger.log(`Cámara ${id} eliminada`);
  }
   // =====================================================
  // STREAM DINÁMICO POR CLUSTER
  // =====================================================

  async getStreamUrl(clusterId: number): Promise<string> {
    const camera =
      await this.cameraRepository.findByClusterId(clusterId);

    if (!camera) {
      throw new NotFoundException(
        `No existe cámara para el cluster ${clusterId}`,
      );
    }

    if (!camera.ip) {
      throw new NotFoundException(
        `La cámara del cluster ${clusterId} no tiene IP`,
      );
    }

    this.logger.log(
      `[CAMERA] Cluster ${clusterId} -> cámara ${camera.id} -> IP ${camera.ip}`,
    );

    return camera.ip;
  }

  async captureForCluster(clusterId: number): Promise<Buffer> {
    const cameras = await this.cameraRepository.findAllByClusterId(clusterId);

    if (cameras.length === 0) {
      throw new NotFoundException(
        `No existe cámara para el cluster ${clusterId}`,
      );
    }

    const errors: string[] = [];
    for (const camera of cameras) {
      if (!camera.ip) {
        errors.push(`La cámara ${camera.id} no tiene URL configurada`);
        continue;
      }

      try {
        const streamAddress = /^https?:\/\//i.test(camera.ip)
          ? camera.ip
          : `http://${camera.ip.includes(':') ? `[${camera.ip}]` : camera.ip}`;
        const streamUrl = new URL(streamAddress).toString();
        return await this.cameraStreamService.captureFrame(camera.id, streamUrl);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        errors.push(`cámara ${camera.id}: ${reason}`);
        this.logger.warn(
          `[CAMERA] Falló la captura desde cámara ${camera.id}; ` +
          `se probará la siguiente cámara configurada`,
        );

        if (isIP(camera.ip)) {
          try {
            const legacyCaptureUrl =
              `http://${camera.ip.includes(':') ? `[${camera.ip}]` : camera.ip}:81/capture`;
            const response = await axios.get<ArrayBuffer>(legacyCaptureUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
            });
            if (response.data.byteLength === 0) {
              throw new Error('la cámara devolvió una imagen vacía');
            }
            return Buffer.from(response.data);
          } catch (captureError) {
            const captureReason =
              captureError instanceof Error
                ? captureError.message
                : String(captureError);
            errors.push(`captura ESP32 de cámara ${camera.id}: ${captureReason}`);
          }
        }
      }
    }

    throw new Error(
      `No se pudo capturar ninguna cámara del cluster ${clusterId}: ${errors.join('; ')}`,
    );
  }
}
