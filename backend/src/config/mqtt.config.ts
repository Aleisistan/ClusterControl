import { ConfigService } from '@nestjs/config';

export interface MqttConfiguration {
  server: string;
  port: number;
  user: string;
  password: string;
}

export const mqttConfig = (
  config: ConfigService,
): MqttConfiguration => ({
  server: config.get<string>('mqtt.server')!,
  port: config.get<number>('mqtt.port')!,
  user: config.get<string>('mqtt.user')!,
  password: config.get<string>('mqtt.password')!,
});