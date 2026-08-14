import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { LoggerService } from '../common/logger/logger.service';

import { CameraPayload } from './dto/camera.payload';
import { CameraRepository } from './repositories/camera.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';

import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Injectable()
export class CameraService {
  private cameraIp = '';

  constructor(
    private readonly logger: LoggerService,
    private readonly cameraRepository: CameraRepository,
    private readonly clusterRepository: ClusterRepository,
  ) {}

  setCameraIp(ip: string): void {
    this.cameraIp = ip;

    this.logger.log(`CAMARA IP ACTUALIZADA: ${ip}`);
  }

  getCameraIp(): string {
    return this.cameraIp;
  }

  async updateFromMqtt(data: CameraPayload): Promise<void> {
    const camera = await this.cameraRepository.findByDeviceId(data.deviceId);

    if (!camera) {
      this.logger.warn(`No existe cámara para el cluster ${data.deviceId}`);

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

    const existingCamera = await this.cameraRepository.findByDeviceId(
      data.deviceId,
    );

    if (existingCamera) {
      this.logger.warn(
        `Intento de crear segunda cámara para cluster ${data.deviceId}`,
      );

      throw new ConflictException('El cluster ya tiene una cámara');
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
}
