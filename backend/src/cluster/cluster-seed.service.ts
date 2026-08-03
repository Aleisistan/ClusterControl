import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cluster } from './entities/cluster.entity';
import { DEFAULT_CLUSTERS } from './clusters.seed';

@Injectable()
export class ClusterSeedService implements OnModuleInit {

  constructor(
    @InjectRepository(Cluster)
    private readonly clusterRepository: Repository<Cluster>,
  ) {}

  async onModuleInit() {

    const cantidad = await this.clusterRepository.count();

    if (cantidad > 0) {
      console.log('Los clusters ya existen.');
      return;
    }

    await this.clusterRepository.save(DEFAULT_CLUSTERS);

    console.log('Clusters inicializados correctamente.');
  }
}