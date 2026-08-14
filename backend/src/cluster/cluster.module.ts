import { Module } from '@nestjs/common';
import { ClusterService } from './cluster.service';
import { ClusterController } from './cluster.controller';
import { Cluster } from './entities/cluster.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterSeedService } from './cluster-seed.service';
import { ClusterRepository } from './repositories/cluster.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Cluster])],
  controllers: [ClusterController],
  providers: [ClusterService, ClusterSeedService, ClusterRepository],
  exports: [ClusterService, ClusterRepository],
})
export class ClusterModule {}
