import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IndustrialTestStatusController } from './industrial-test-status.controller';
import { IndustrialTestStatusService } from './industrial-test-status.service';

@Module({
  imports: [AuthModule],
  controllers: [IndustrialTestStatusController],
  providers: [IndustrialTestStatusService, RolesGuard],
})
export class IndustrialTestStatusModule {}
