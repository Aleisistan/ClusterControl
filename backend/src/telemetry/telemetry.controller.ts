import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('telemetry')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('latest')
  getLatest(@Query('clusterId', ParseIntPipe) clusterId: number) {
    return this.telemetryService.getLatest(clusterId);
  }

  @Get('history')
  getHistory(
    @Query('clusterId', ParseIntPipe) clusterId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.telemetryService.getHistory(clusterId, from, to, limit);
  }

  @Get('state-history')
  getStateHistory(
    @Query('clusterId', ParseIntPipe) clusterId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.telemetryService.getStateHistory(clusterId, from, to, limit);
  }

  @Get('door-snapshots/:id/image')
  async getDoorSnapshotImage(
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.telemetryService.getDoorSnapshotImage(id);

    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="captura-puerta-${id}.jpg"`,
    );
    response.send(image);
  }
}
