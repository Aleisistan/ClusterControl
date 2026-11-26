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
    if (!cluster) {
      this.logger.warn(
        `No existe cluster para la cámara ${deviceId} ` +
        `(se esperaba deviceId MQTT o ID interno del cluster)`,
      );
      return;
    }

    const clusterCameras =
      await this.cameraRepository.findAllByClusterId(cluster.id);
    const requestedCameraId =
      data.cameraId !== undefined ? Number(data.cameraId) : undefined;
    const requestedSlot =
      data.slot !== undefined ? Number(data.slot) : undefined;
    const cameraById =
      requestedCameraId !== undefined
        ? await this.cameraRepository.findById(requestedCameraId)
        : null;
    const cameraByIp =
      await this.cameraRepository.findByIp(data.ip);
    const camera =
      (cameraById?.cluster?.id === cluster.id ? cameraById : null)
      ?? (requestedSlot !== undefined
        ? clusterCameras.find((item) => item.slot === requestedSlot)
        : null)
      ?? (requestedCameraId === undefined && requestedSlot === undefined
        ? (cameraByIp?.cluster?.id === cluster.id ? cameraByIp : null)
          ?? clusterCameras.find((item) => item.slot === 1)
          ?? (clusterCameras.length >= 2 ? clusterCameras[0] : null)
        : null)
      ?? null;

    if (!camera) {
      if (clusterCameras.length >= 2) {
        this.logger.warn(
          `No se puede registrar una tercera cámara para el cluster ${cluster.id}`,
        );
        return;
      }

      const requestedSlotAvailable =
        requestedSlot === 1 || requestedSlot === 2
          ? !clusterCameras.some((item) => item.slot === requestedSlot)
          : false;
      const newSlot = requestedSlotAvailable
        ? requestedSlot
        : this.firstAvailableSlot(clusterCameras);
      const newCamera = this.cameraRepository.create({
        name: `Cámara ${newSlot}`,
        ip: data.ip,
        slot: newSlot,
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

    const cameraInSlot = await this.cameraRepository.findByClusterSlot(
      cluster.id,
      data.slot,
    );
    if (cameraInSlot) {
      throw new ConflictException(
        `El slot ${data.slot} ya tiene una cámara configurada`,
      );
    }

    const existingAddress = await this.cameraRepository.findByIp(data.ip);
    if (existingAddress) {
      throw new ConflictException('La dirección ya está asignada a otra cámara');
    }

    const camera = this.cameraRepository.create({
      name: data.name,
      ip: data.ip,
      slot: data.slot,
      cluster,
    });

    let savedCamera;
    try {
      savedCamera = await this.cameraRepository.save(camera);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const conflict = this.getCameraUniqueConstraintConflict(
          error,
          data.slot,
        );
        if (conflict) {
          throw new ConflictException(conflict);
        }

        throw new ConflictException(
          'La dirección o el slot ya está asignado a otra cámara',
        );
      }
      throw error;
    }

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

    if (data.slot !== undefined && data.slot !== camera.slot) {
      const cameraInSlot = await this.cameraRepository.findByClusterSlot(
        camera.cluster.id,
        data.slot,
      );
      if (cameraInSlot && cameraInSlot.id !== camera.id) {
        throw new ConflictException(
          `El slot ${data.slot} ya tiene una cámara configurada`,
        );
      }
      camera.slot = data.slot;
    }

    let updatedCamera;
    try {
      updatedCamera = await this.cameraRepository.save(camera);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'La dirección o el slot ya está asignado a otra cámara',
        );
      }
      throw error;
    }

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

  private firstAvailableSlot(cameras: Array<{ slot?: number }>): number {
    const usedSlots = new Set(cameras.map((camera) => camera.slot));
    const slot = [1, 2].find((candidate) => !usedSlots.has(candidate));
    if (!slot) {
      throw new ConflictException('El cluster ya tiene el máximo de 2 cámaras');
    }
    return slot;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('driverError' in error)) {
      return false;
    }

    const driverError: unknown = error.driverError;
    return (
      driverError !== null &&
      typeof driverError === 'object' &&
      'code' in driverError &&
      driverError.code === '23505'
    );
  }

  private getCameraUniqueConstraintConflict(
    error: unknown,
    slot: number,
  ): string | undefined {
    if (!error || typeof error !== 'object' || !('driverError' in error)) {
      return undefined;
    }

    const driverError: unknown = error.driverError;
    if (!driverError || typeof driverError !== 'object') {
      return undefined;
    }

    const constraint =
      'constraint' in driverError && typeof driverError.constraint === 'string'
        ? driverError.constraint
        : '';
    const detail =
      'detail' in driverError && typeof driverError.detail === 'string'
        ? driverError.detail
        : '';

    if (
      constraint === 'UQ_camera_cluster_slot' ||
      /Key \((?:"clusterId",\s*)?slot\)=/.test(detail)
    ) {
      return `El slot ${slot} ya tiene una cámara configurada`;
    }

    if (
      constraint === 'UQ_f4ccf9e2171a1edcf08ddb2e47b' ||
      /Key \("?ip"?\)=/.test(detail)
    ) {
      return 'La dirección ya está asignada a otra cámara';
    }

    return undefined;
  }
}
