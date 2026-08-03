import { Module } from '@nestjs/common';
import { ClusterService } from './cluster.service';
import { ClusterController } from './cluster.controller';
import { Cluster } from './entities/cluster.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterSeedService } from './cluster-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cluster
    ])
  ],
  controllers: [ClusterController],
  providers: [ClusterService,
    ClusterSeedService
  ],
  exports: [ClusterService]
})
export class ClusterModule {}
