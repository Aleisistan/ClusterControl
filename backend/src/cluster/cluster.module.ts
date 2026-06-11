import { Module } from '@nestjs/common';
import { ClusterService } from './cluster.service';
import { ClusterController } from './cluster.controller';
import { Cluster } from './entities/cluster.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cluster
    ])
  ],
  controllers: [ClusterController],
  providers: [ClusterService],
  exports: [ClusterService]
})
export class ClusterModule {}
