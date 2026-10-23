import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
