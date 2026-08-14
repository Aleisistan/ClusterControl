import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';
import { ClusterRepository } from './repositories/cluster.repository';
import { Cluster } from './entities/cluster.entity';

@Injectable()
export class ClusterService {
  constructor(private readonly clusterRepository: ClusterRepository) {}

  async findAll(): Promise<Cluster[]> {
    return this.clusterRepository.findAll();
  }

  async create(data: CreateClusterDto): Promise<Cluster> {
    const existingName = await this.clusterRepository.findByName(data.name);

    if (existingName) {
      throw new ConflictException('No se puede crear el cluster');
    }

    if (data.deviceId) {
      const existingDevice = await this.clusterRepository.findByDeviceId(
        data.deviceId,
      );

      if (existingDevice) {
        throw new ConflictException('No se puede crear el cluster');
      }
    }

    const cluster = this.clusterRepository.create(data);

    return this.clusterRepository.save(cluster);
  }
  async update(id: number, data: UpdateClusterDto): Promise<Cluster> {
    const cluster = await this.clusterRepository.findById(id);

    if (!cluster) {
      throw new NotFoundException('Cluster no encontrado');
    }

    if (data.deviceId && data.deviceId !== cluster.deviceId) {
      const existingName = await this.clusterRepository.findByName(
        data.deviceId,
      );

      if (existingName && existingName.id !== id) {
        throw new ConflictException('No se puede actualizar el cluster');
      }

      cluster.name = data.deviceId;
    }

    if (data.deviceId !== undefined && data.deviceId !== cluster.deviceId) {
      const existing = await this.clusterRepository.findByDeviceId(
        data.deviceId,
      );

      if (existing && existing.id !== id) {
        throw new ConflictException('No se puede actualizar el cluster');
      }

      cluster.deviceId = data.deviceId;
    }

    if (data.location !== undefined) {
      cluster.location = data.location;
    }

    if (data.lat !== undefined) {
      cluster.lat = data.lat;
    }

    if (data.lon !== undefined) {
      cluster.lon = data.lon;
    }

    if (data.timezone !== undefined) {
      cluster.timezone = data.timezone;
    }

    return this.clusterRepository.update(cluster);
  }
  async findOne(id: number) {
    const cluster = await this.clusterRepository.findById(id);

    if (!cluster) {
      throw new NotFoundException('Cluster no encontrado');
    }

    return cluster;
  }
  async delete(id: number): Promise<void> {
    const cluster = await this.clusterRepository.findById(id);

    if (!cluster) {
      throw new NotFoundException('Cluster no encontrado');
    }

    await this.clusterRepository.delete(id);
  }
}
