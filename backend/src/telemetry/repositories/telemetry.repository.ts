import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

  async findLatest(clusterId: number) {
    return this.repository.find({
      where: {
        cluster: {
          id: clusterId,
        },
      },

      order: {
        created_at: 'DESC',
      },

      take: 1,
    });
  }

  async findHistory(clusterId: number) {
    return this.repository.find({
      where: {
        cluster: {
          id: clusterId,
        },
      },

      order: {
        created_at: 'DESC',
      },

      take: 100,
    });
  }
}
