import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterModule } from '../cluster/cluster.module';
import { AlertConfiguration } from './alert-configuration.entity';
import { AlertsController } from './alerts.controller';
import { AlertsMailService } from './alerts-mail.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [TypeOrmModule.forFeature([AlertConfiguration]), ClusterModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsMailService],
  exports: [AlertsService],
})
export class AlertsModule {}
