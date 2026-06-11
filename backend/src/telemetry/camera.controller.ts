import { Controller, Get } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('camera')
export class CameraController {

  constructor(
    private telemetryService: TelemetryService
  ) {}

  @Get('ip')
  getCameraIp() {

    return {
      ip: this.telemetryService.cameraIp
    };

  }
}