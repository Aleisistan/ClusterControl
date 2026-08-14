import { ConfigService } from '@nestjs/config';

export interface MqttConfiguration {
  server: string;
  port: number;
  user: string;
  password: string;
}

export const mqttConfig = (config: ConfigService): MqttConfiguration => ({
  server: config.getOrThrow<string>('mqtt.server'),
  port: config.getOrThrow<number>('mqtt.port'),
  user: config.getOrThrow<string>('mqtt.user'),
  password: config.getOrThrow<string>('mqtt.password'),
});
