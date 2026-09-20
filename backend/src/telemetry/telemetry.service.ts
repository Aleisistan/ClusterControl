import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TelemetryPayload } from './dto/telemetry.payload';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { ClusterRepository } from '../cluster/repositories/cluster.repository';
import { NotFoundException } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { TelemetryResponseDto } from './dto/telemetry-response.dto';

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private static readonly RETENTION_DAYS = 30;
  private static readonly HISTORY_LIMIT = 2000;
  private retentionTimer?: NodeJS.Timeout;

  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly clusterRepository: ClusterRepository,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.removeExpiredTelemetry();
    this.retentionTimer = setInterval(
      () => void this.removeExpiredTelemetry(),
      24 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
    }
  }

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

  async getHistory(
    clusterId: number,
    fromParam?: string,
    toParam?: string,
    limitParam?: string,
  ): Promise<TelemetryResponseDto[]> {
    const now = new Date();
    const retentionStart = this.getRetentionStart(now);
    const from = this.parseDate(fromParam, 'from') ?? retentionStart;
    const requestedTo = this.parseDate(toParam, 'to') ?? now;
    const to = requestedTo > now ? now : requestedTo;
    const limit = this.parseLimit(limitParam);

    if (from > to) {
      throw new BadRequestException('El rango de fechas no es válido');
    }

    const effectiveFrom = from < retentionStart ? retentionStart : from;
    if (effectiveFrom > to) {
      return [];
    }

    const telemetry = await this.telemetryRepository.findHistory(
      clusterId,
      effectiveFrom,
      to,
      limit,
    );

    return telemetry.map((item) => new TelemetryResponseDto(item));
  }

  private getRetentionStart(now: Date): Date {
    const retentionStart = new Date(now);
    retentionStart.setDate(
      retentionStart.getDate() - TelemetryService.RETENTION_DAYS,
    );
    return retentionStart;
  }

  private parseDate(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`La fecha '${field}' no es válida`);
    }

    return parsed;
  }

  private parseLimit(value: string | undefined): number {
    if (!value) return TelemetryService.HISTORY_LIMIT;

    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('El límite debe ser un entero positivo');
    }

    return Math.min(limit, TelemetryService.HISTORY_LIMIT);
  }

  private async removeExpiredTelemetry(): Promise<void> {
    const removed = await this.telemetryRepository.deleteOlderThan(
      this.getRetentionStart(new Date()),
    );

    if (removed > 0) {
      this.logger.log(`[RETENTION] Telemetría eliminada: ${removed} registros`);
    }
  }
}
