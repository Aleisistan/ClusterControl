import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EventHandler } from '../event-handler.interface';
import { MQTT_TOPICS } from '../../config/topics';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { TelemetryPayload } from '../../telemetry/dto/telemetry.payload';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class TelemetryHandler implements EventHandler {

  topic = MQTT_TOPICS.TELEMETRY;

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly logger: LoggerService,
  ) {}

  async handle(data: unknown): Promise<void> {

    const payload = plainToInstance(
      TelemetryPayload,
      data,
    );

    const errors = await validate(payload, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {

      const messages = errors.flatMap(
        (error) => 
          Object.values(error.constraints ?? {}),
      
      );

      this.logger.warn(
        `[MQTT] Payload de telemetría inválido: ${messages.join('; ')}`,
      );

      return;
    }
    this .logger.log(
      `[MQTT] Payload válido: deviceId=${payload.deviceId}`);

    await this.telemetryService.saveTelemetry(payload);
  }
}