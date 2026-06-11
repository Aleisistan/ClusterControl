import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cluster } from './entities/cluster.entity';

@Injectable()
export class ClusterService {

  constructor(
    @InjectRepository(Cluster)
    private clusterRepository: Repository<Cluster>,
  ) {}

  findAll() {
    return this.clusterRepository.find();
  }

  findOne(id: number) {
    return this.clusterRepository.findOne({
      where: { id }
    });
  }
}