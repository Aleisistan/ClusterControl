import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IndustrialTestStatusService } from './industrial-test-status.service';

@Controller('industrial-tests')
@UseGuards(JwtAuthGuard)
export class IndustrialTestStatusController {
  constructor(
    private readonly industrialTestStatusService: IndustrialTestStatusService,
  ) {}

  @Get('status')
  getStatus() {
    return this.industrialTestStatusService.getStatus();
  }

  @Post('start')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  start(@Body() body: { hours?: unknown }) {
    return this.industrialTestStatusService.startRun(body?.hours);
  }
}
