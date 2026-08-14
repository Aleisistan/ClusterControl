import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';

import { Camera } from './entities/camera.entity';
import { CameraRepository } from './repositories/camera.repository';
import { ClusterModule } from '../cluster/cluster.module';

@Module({
  imports: [TypeOrmModule.forFeature([Camera]), ClusterModule],
  controllers: [CameraController],
  providers: [CameraService, CameraRepository],
  exports: [CameraService, CameraRepository],
})
export class CameraModule {}
