import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [ConfigModule, EventsModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
