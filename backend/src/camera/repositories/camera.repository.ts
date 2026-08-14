import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Camera } from '../entities/camera.entity';

@Injectable()
export class CameraRepository {
  constructor(
    @InjectRepository(Camera)
    private readonly repository: Repository<Camera>,
  ) {}

  create(data: Partial<Camera>) {
    return this.repository.create(data);
  }

  async save(camera: Camera) {
    return this.repository.save(camera);
  }

  async findAll() {
    return this.repository.find();
  }

  async findById(id: number) {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByIp(ip: string) {
    return this.repository.findOne({
      where: { ip },
    });
  }

  async findByDeviceId(deviceId: string) {
    return this.repository.findOne({
      where: {
        cluster: {
          deviceId: deviceId,
        },
      },
    });
  }

  async remove(camera: Camera) {
    return this.repository.remove(camera);
  }
  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
