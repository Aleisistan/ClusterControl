import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

import { mqttConfig } from '../config/mqtt.config';
import { MQTT_TOPICS } from '../config/topics';

import { EventDispatcher } from '../events/event-dispatcher.service';
import { LoggerService } from '../common/logger/logger.service';
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly dispatcher: EventDispatcher,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    const config = mqttConfig(this.configService);

    this.client = mqtt.connect({
      host: config.server,
      port: config.port,
      username: config.user || undefined,
      password: config.password || undefined,
    });

    this.client.on('connect', () => {
      this.logger.log('MQTT conectado');

      this.client.subscribe(MQTT_TOPICS.TELEMETRY);
      this.client.subscribe(MQTT_TOPICS.CAMERA_IP);
    });

    this.client.on('message', (topic, message) => {
      void this.handleMessage(topic, message);
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`[MQTT] Error de conexión: ${error.message}`);
    });
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  private async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      let data: unknown;
      try {
        data = JSON.parse(message.toString());
      } catch {
        this.logger.warn(`[MQTT] JSON inválido en topic "${topic}"`);
        return;
      }

      await this.dispatcher.dispatch(topic, data);
    } catch (error) {
      this.logger.error(
        `[MQTT] Error procesando mensaje en "${topic}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
