import { Module, OnModuleInit } from '@nestjs/common';

import { CameraModule } from '../camera/camera.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

import { EventDispatcher } from './event-dispatcher.service';
import { EventRegistry } from './event-registry.service';

import { CameraHandler } from './handlers/camera.handler';
import { TelemetryHandler } from './handlers/telemetry.handler';

@Module({
  imports: [CameraModule, TelemetryModule],
  providers: [EventDispatcher, CameraHandler, TelemetryHandler, EventRegistry],
  exports: [EventDispatcher],
})
export class EventsModule implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    private readonly cameraHandler: CameraHandler,
    private readonly telemetryHandler: TelemetryHandler,
  ) {}
  onModuleInit() {
    this.registry.register(this.cameraHandler);
    this.registry.register(this.telemetryHandler);
  }
}
