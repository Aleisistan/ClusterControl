import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
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

    const deviceId = data.deviceId?.trim();

    if (deviceId) {
      const existingDevice =
        await this.clusterRepository.findByDeviceId(deviceId);

      if (existingDevice) {
        throw new ConflictException('No se puede crear el cluster');
      }
    }

    const cluster = this.clusterRepository.create({
      ...data,
      deviceId: deviceId || undefined,
    });
    let savedCluster: Cluster;
    try {
      savedCluster = await this.clusterRepository.save(cluster);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('El nombre o deviceId ya está en uso.');
      }

      throw error;
    }

    if (deviceId) {
      return savedCluster;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      savedCluster.deviceId = await this.generateDeviceId(savedCluster.id);

      try {
        return await this.clusterRepository.save(savedCluster);
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException('No se pudo asignar un deviceId único.');
  }
  async update(id: number, data: UpdateClusterDto): Promise<Cluster> {
    const cluster = await this.clusterRepository.findById(id);

    if (!cluster) {
      throw new NotFoundException('Cluster no encontrado');
    }

    if (data.deviceId !== undefined && data.deviceId !== cluster.deviceId) {
      const deviceId = data.deviceId.trim();
      const existing = await this.clusterRepository.findByDeviceId(deviceId);

      if (existing && existing.id !== id) {
        throw new ConflictException('No se puede actualizar el cluster');
      }

      cluster.deviceId = deviceId;
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

    try {
      await this.clusterRepository.delete(id);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'No se puede eliminar el cluster porque tiene datos relacionados.',
        );
      }

      throw error;
    }
  }

  private async generateDeviceId(clusterId: number): Promise<string> {
    let candidate = clusterId;

    while (await this.clusterRepository.findByDeviceId(String(candidate))) {
      candidate += 1;
    }

    return String(candidate);
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.getDriverErrorCode(error) === '23505';
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return this.getDriverErrorCode(error) === '23503';
  }

  private getDriverErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) {
      return undefined;
    }

    const driverError = error.driverError as { code?: string };
    return driverError.code;
  }
}
