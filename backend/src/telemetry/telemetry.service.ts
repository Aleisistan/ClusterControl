import { Injectable } from '@nestjs/common';
import { TelemetryPayload } from './dto/telemetry.payload';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { NotFoundException } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { TelemetryResponseDto } from './dto/telemetry-response.dto';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly clusterRepository: ClusterRepository,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly logger: LoggerService,
  ) {}

  async saveTelemetry(data: TelemetryPayload) {
    const cluster = await this.clusterRepository.findByDeviceId(
      data.deviceId.toString(),
    );

    if (!cluster) {

    this.logger.warn(
      `[MQTT] deviceId desconocido: ${data.deviceId}`,
    );

    return null;
  }
    const telemetry = this.telemetryRepository.create({
      temperature1: data.temp1,

      temperature2: data.temp2,

      humidity1: data.hum1,

      humidity2: data.hum2,

      extractor: data.extractor,

      aire: data.aire,

      puerta: data.puerta,

      cluster,
    });

    await this.telemetryRepository.save(telemetry);

    this.logger.log(
    `[MQTT] Telemetría guardada: ` +
    `deviceId=${data.deviceId}, ` +
    `clusterId=${cluster.id}, ` +
    `telemetryId=${telemetry.id}`,
  );

    // IMPORTANTE: le pasamos la entidad CRUDA (con la relación
    // 'cluster' todavía anidada como objeto) al gateway, NO un DTO
    // ya aplanado. El gateway internamente arma su propio
    // TelemetryResponseDto a partir de esto (lee data.cluster?.id).
    // Antes se le pasaba acá un DTO ya convertido, que ya NO tenía
    // 'cluster' anidado (solo 'clusterId' plano) — el gateway volvía
    // a intentar leer data.cluster?.id sobre ese DTO, y como ya no
    // existía, el clusterId se perdía (undefined) justo antes de
    // emitir por WebSocket.
    this.telemetryGateway.sendTelemetry(telemetry);

    this.logger.log('Guardado PostgreSQL');

    return telemetry;
  }
  async getLatest(clusterId: number): Promise<TelemetryResponseDto> {
    const telemetry = await this.telemetryRepository.findLatest(clusterId);

    if (!telemetry) {
      throw new NotFoundException(
        `Telemetry for cluster ${clusterId} not found`,
      );
    }

    return new TelemetryResponseDto(telemetry);
  }

  async getHistory(clusterId: number): Promise<TelemetryResponseDto[]> {
    const telemetry = await this.telemetryRepository.findHistory(clusterId);

    return telemetry.map((item) => new TelemetryResponseDto(item));
  }
}
