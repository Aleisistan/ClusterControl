import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryController } from './telemetry.controller';
import { CameraModule } from '../camera/camera.module';
import { Telemetry } from './telemetry.entity';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryService } from './telemetry.service';
import { Cluster } from '../cluster/entities/cluster.entity';
import { ClusterModule } from '../cluster/cluster.module';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Telemetry, Cluster]),
    CameraModule,
    ClusterModule,
    AuthModule,
  ],
  providers: [TelemetryService, TelemetryGateway, TelemetryRepository],
  controllers: [TelemetryController],
  exports: [TelemetryService, TelemetryRepository],
})
export class TelemetryModule {}
