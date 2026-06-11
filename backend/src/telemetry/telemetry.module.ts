import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryController } from './telemetry.controller';
import { CameraController } from './camera.controller';
import { Telemetry } from './telemetry.entity';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryService } from './telemetry.service';
import { Cluster } from '../cluster/entities/cluster.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry, Cluster])],
  providers: [TelemetryService, TelemetryGateway],
  controllers: [TelemetryController, CameraController],
})
export class TelemetryModule {}
