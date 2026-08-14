import { Injectable, OnModuleInit } from '@nestjs/common';

import { ClusterRepository } from './repositories/cluster.repository';
import { LoggerService } from '../common/logger/logger.service';

import { DEFAULT_CLUSTERS } from './clusters.seed';

@Injectable()
export class ClusterSeedService implements OnModuleInit {
  constructor(
    private readonly clusterRepository: ClusterRepository,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    let created = 0;

    for (const data of DEFAULT_CLUSTERS) {
      const existing = await this.clusterRepository.findByName(data.name);

      if (existing) {
        continue;
      }

      const cluster = this.clusterRepository.create(data);

      await this.clusterRepository.save(cluster);

      created++;
    }

    if (created > 0) {
      this.logger.log(`${created} cluster(s) inicializado(s) correctamente`);
    } else {
      this.logger.log('Los clusters por defecto ya existen');
    }
  }
}
