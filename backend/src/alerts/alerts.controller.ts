import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AlertsService } from './alerts.service';
import { UpdateAlertConfigurationDto } from './dto/update-alert-configuration.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('configuration/:clusterId')
  getConfiguration(@Param('clusterId', ParseIntPipe) clusterId: number) {
    return this.alerts.getConfiguration(clusterId);
  }

  @Patch('configuration/:clusterId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateConfiguration(
    @Param('clusterId', ParseIntPipe) clusterId: number,
    @Body() data: UpdateAlertConfigurationDto,
  ) {
    return this.alerts.updateConfiguration(clusterId, data);
  }

  @Post('test-email/:clusterId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async sendTestEmail(
    @Param('clusterId', ParseIntPipe) clusterId: number,
  ): Promise<{ sent: true }> {
    await this.alerts.sendTestEmail(clusterId);
    return { sent: true };
  }
}
