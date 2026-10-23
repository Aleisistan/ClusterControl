import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DoorSnapshot } from '../door-snapshot.entity';
import { Telemetry } from '../telemetry.entity';

@Injectable()
export class DoorSnapshotRepository {
  constructor(
    @InjectRepository(DoorSnapshot)
    private readonly repository: Repository<DoorSnapshot>,
  ) {}

  async save(snapshot: Partial<DoorSnapshot>): Promise<DoorSnapshot> {
    return this.repository.save(this.repository.create(snapshot));
  }

  async findHistory(
    clusterId: number,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<DoorSnapshot[]> {
    return this.repository
      .createQueryBuilder('snapshot')
      .innerJoin(
        Telemetry,
        'telemetry',
        'telemetry.id = snapshot."telemetryId"',
      )
      .select('snapshot.id', 'id')
      .addSelect('snapshot."telemetryId"', 'telemetryId')
      .addSelect('snapshot."createdAt"', 'createdAt')
      .where('snapshot.cluster_id = :clusterId', { clusterId })
      .andWhere('snapshot."createdAt" BETWEEN :from AND :to', { from, to })
      .andWhere("telemetry.source = 'device'")
      .orderBy('snapshot."createdAt"', 'DESC')
      .addOrderBy('snapshot.id', 'DESC')
      .limit(limit)
      .getRawMany<DoorSnapshot>();
  }

  async findImage(id: number): Promise<Buffer | null> {
    const snapshot = await this.repository.findOne({
      select: { id: true, image: true },
      where: { id },
    });

    return snapshot?.image ?? null;
  }
}
