import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IndustrialTestStatusController } from './industrial-test-status.controller';
import { IndustrialTestStatusService } from './industrial-test-status.service';

@Module({
  imports: [AuthModule],
  controllers: [IndustrialTestStatusController],
  providers: [IndustrialTestStatusService],
})
export class IndustrialTestStatusModule {}
