import { Controller, Get, Query } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService,
  ) {}

 @Get('latest')
  getLatest(@Query('clusterId') clusterId: string) {
  return this.telemetryService.getLatest(+clusterId);
}

  @Get('history')
  getHistory(@Query('clusterId') clusterId: string) {
  return this.telemetryService.getHistory(+clusterId);
}
}
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
