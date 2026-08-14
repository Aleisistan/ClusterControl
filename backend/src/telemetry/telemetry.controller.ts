import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('telemetry')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('latest')
  getLatest(@Query('clusterId', ParseIntPipe) clusterId: number) {
    return this.telemetryService.getLatest(clusterId);
  }

  @Get('history')
  getHistory(@Query('clusterId', ParseIntPipe) clusterId: number) {
    return this.telemetryService.getHistory(clusterId);
  }
}
