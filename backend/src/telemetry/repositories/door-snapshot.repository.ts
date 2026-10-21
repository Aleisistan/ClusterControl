import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { DoorSnapshot } from '../door-snapshot.entity';

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
    return this.repository.find({
      select: {
        id: true,
        telemetryId: true,
        createdAt: true,
      },
      where: {
        cluster: { id: clusterId },
        createdAt: Between(from, to),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  async findImage(id: number): Promise<Buffer | null> {
    const snapshot = await this.repository.findOne({
      select: { id: true, image: true },
      where: { id },
    });

    return snapshot?.image ?? null;
  }
}
