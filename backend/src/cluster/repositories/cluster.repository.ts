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
      relations: { cameras: true },
    });
  }

  async findAll() {
    const clusters = await this.repository.find({
      relations: { cameras: true },
    });

    if (clusters.length === 0) {
      return clusters;
    }

    const lastSeenRows = await this.repository.query<
      Array<{ clusterId: number; lastSeenAt: Date | string }>
    >(
      `
        SELECT cluster_id AS "clusterId", MAX(created_at) AS "lastSeenAt"
        FROM telemetry
        WHERE source = $1 AND cluster_id = ANY($2)
        GROUP BY cluster_id
      `,
      ['device', clusters.map(({ id }) => id)],
    );
    const lastSeenByCluster = new Map(
      lastSeenRows.map(({ clusterId, lastSeenAt }) => [
        Number(clusterId),
        new Date(lastSeenAt).toISOString(),
      ]),
    );

    return clusters.map((cluster) => {
      cluster.lastSeenAt = lastSeenByCluster.get(cluster.id) ?? null;
      return cluster;
    });
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
