import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EventHandler } from '../event-handler.interface';
import { MQTT_TOPICS } from '../../config/topics';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { TelemetryPayload } from '../../telemetry/dto/telemetry.payload';
import { LoggerService } from '../../common/logger/logger.service';
import { validate } from 'class-validator';

@Injectable()
export class TelemetryHandler implements EventHandler {
  topic = MQTT_TOPICS.TELEMETRY;

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly logger: LoggerService,
  ) {}

  async handle(data: any): Promise<void> {
    const payload = plainToInstance(TelemetryPayload, data);

    const errors = await validate(payload, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      this.logger.warn('Payload MQTT de telemetría rechazado');

      return;
    }

    await this.telemetryService.saveTelemetry(payload);
  }
}
