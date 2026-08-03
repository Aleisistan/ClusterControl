import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

import { mqttConfig } from '../config/mqtt.config';

@Injectable()
export class MqttService implements OnModuleInit {

  constructor(
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {

    const mqttConfiguration = mqttConfig(this.configService);

    console.log("MQTT CONFIG:", mqttConfiguration);


  }
}