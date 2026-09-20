import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';

import { Telemetry } from '../telemetry.entity';

@Injectable()
export class TelemetryRepository {
  constructor(
    @InjectRepository(Telemetry)
    private repository: Repository<Telemetry>,
  ) {}

  create(data: Partial<Telemetry>) {
    return this.repository.create(data);
  }

  async save(telemetry: Telemetry) {
    return this.repository.save(telemetry);
  }

  async findLatest(clusterId: number): Promise<Telemetry | null> {
    return this.repository.findOne({
      where: { cluster: { id: clusterId } },
      order: { created_at: 'DESC' },
    });
  }

  async findHistory(
    clusterId: number,
    from: Date,
    to: Date,
    limit: number,
  ) {
    return this.repository.find({
      where: {
        cluster: { id: clusterId },
        created_at: Between(from, to),
      },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repository.delete({
      created_at: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }
}
