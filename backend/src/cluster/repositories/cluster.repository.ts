import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cluster } from '../entities/cluster.entity';

@Injectable()
export class ClusterRepository {
  constructor(
    @InjectRepository(Cluster)
    private readonly repository: Repository<Cluster>,
  ) {}

  async findById(id: number) {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findAll() {
    return this.repository.find();
  }
  async findByName(name: string): Promise<Cluster | null> {
    return this.repository.findOne({
      where: { name },
    });
  }
  async findByDeviceId(deviceId: string): Promise<Cluster | null> {
    return this.repository.findOne({
      where: { deviceId },
    });
  }
  async save(cluster: Cluster) {
    return this.repository.save(cluster);
  }

  create(data: Partial<Cluster>): Cluster {
    return this.repository.create(data);
  }
  async update(cluster: Cluster): Promise<Cluster> {
    return this.repository.save(cluster);
  }
  async remove(cluster: Cluster) {
    return this.repository.remove(cluster);
  }
  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
