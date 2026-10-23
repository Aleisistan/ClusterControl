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
import { LoggerService } from '../common/logger/logger.service';
import { TelemetryResponseDto } from './dto/telemetry-response.dto';
import { CameraService } from '../camera/camera.service';
import { DoorSnapshotRepository } from './repositories/door-snapshot.repository';
import { Cluster } from '../cluster/entities/cluster.entity';

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private static readonly RETENTION_DAYS = 30;
  private static readonly HISTORY_LIMIT = 2000;
  private static readonly TELEMETRY_HISTORY_LIMIT = 10000;
  private retentionTimer?: NodeJS.Timeout;

  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly clusterRepository: ClusterRepository,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly logger: LoggerService,
    private readonly cameraService: CameraService,
    private readonly doorSnapshotRepository: DoorSnapshotRepository,
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
    const source = data.source ?? 'device';
    const previousTelemetry =
      source === 'device'
        ? await this.telemetryRepository.findLatestDevice(cluster.id)
        : null;
    const telemetry = this.telemetryRepository.create({
      temperature1: data.temp1,

      temperature2: data.temp2,

      humidity1: data.hum1,

      humidity2: data.hum2,

      extractor: data.extractor,

      aire: data.aire,

      puerta: data.puerta,

      luzEncendida: data.puerta || data.luzEncendida,

      source,

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

    if (
      telemetry.source === 'device' &&
      previousTelemetry?.source === 'device' &&
      !previousTelemetry.puerta &&
      telemetry.puerta
    ) {
      void this.captureDoorSnapshot(cluster, telemetry.id);
    }

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

  async getLatestDevice(
    clusterId: number,
  ): Promise<TelemetryResponseDto | null> {
    const telemetry =
      await this.telemetryRepository.findLatestDevice(clusterId);
    return telemetry ? new TelemetryResponseDto(telemetry) : null;
  }

  async getHistory(
    clusterId: number,
    fromParam?: string,
    toParam?: string,
    limitParam?: string,
    sourceParam?: string,
  ): Promise<TelemetryResponseDto[]> {
    const now = new Date();
    const range = this.getEffectiveRange(fromParam, toParam, now);
    const limit = this.parseLimit(limitParam, TelemetryService.TELEMETRY_HISTORY_LIMIT);
    if (
      sourceParam !== undefined &&
      sourceParam !== 'device' &&
      sourceParam !== 'industrial-test'
    ) {
      throw new BadRequestException(
        'Telemetry source must be "device" or "industrial-test"',
      );
    }

    if (!range) return [];

    const telemetry = await this.telemetryRepository.findHistory(
      clusterId,
      range.from,
      range.to,
      limit,
      sourceParam,
    );

    return telemetry.map((item) => new TelemetryResponseDto(item));
  }

  async getStateHistory(
    clusterId: number,
    fromParam?: string,
    toParam?: string,
    limitParam?: string,
  ) {
    const range = this.getEffectiveRange(fromParam, toParam, new Date());
    const limit = this.parseLimit(limitParam);

    if (!range) return [];

    const [stateChanges, outages, snapshots] = await Promise.all([
      this.telemetryRepository.findStateChanges(
        clusterId,
        range.from,
        range.to,
        limit,
      ),
      this.telemetryRepository.findOutages(
        clusterId,
        range.from,
        range.to,
        limit,
      ),
      this.doorSnapshotRepository.findHistory(
        clusterId,
        range.from,
        range.to,
        limit,
      ),
    ]);

    const snapshotEvents = snapshots.map((snapshot) => ({
      id: `door-snapshot-${snapshot.id}`,
      eventType: 'door-snapshot' as const,
      snapshotId: snapshot.id,
      telemetryId: snapshot.telemetryId,
      createdAt: snapshot.createdAt,
    }));

    return [...stateChanges, ...outages, ...snapshotEvents]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  async getDoorSnapshotImage(snapshotId: number): Promise<Buffer> {
    const image = await this.doorSnapshotRepository.findImage(snapshotId);

    if (!image) {
      throw new NotFoundException(
        `No existe captura de puerta con ID ${snapshotId}`,
      );
    }

    return image;
  }

  private async captureDoorSnapshot(
    cluster: Cluster,
    telemetryId: number,
  ): Promise<void> {
    try {
      const image = await this.cameraService.captureForCluster(cluster.id);
      const snapshot = await this.doorSnapshotRepository.save({
        telemetryId,
        image,
        cluster,
      });

      this.logger.log(
        `[CAMERA] Captura guardada para apertura de puerta: ` +
        `clusterId=${cluster.id}, telemetryId=${telemetryId}, snapshotId=${snapshot.id}`,
      );
      this.telemetryGateway.sendDoorSnapshot({
        clusterId: cluster.id,
        snapshotId: snapshot.id,
        telemetryId,
        createdAt: snapshot.createdAt,
      });
    } catch (error) {
      this.logger.error(
        `[CAMERA] No se pudo guardar captura por apertura de puerta ` +
        `(clusterId=${cluster.id}, telemetryId=${telemetryId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private getEffectiveRange(
    fromParam: string | undefined,
    toParam: string | undefined,
    now: Date,
  ): { from: Date; to: Date } | null {
    const retentionStart = this.getRetentionStart(now);
    const from = this.parseDate(fromParam, 'from') ?? retentionStart;
    const requestedTo = this.parseDate(toParam, 'to') ?? now;
    const to = requestedTo > now ? now : requestedTo;

    if (from > to) {
      throw new BadRequestException('El rango de fechas no es válido');
    }

    const effectiveFrom = from < retentionStart ? retentionStart : from;
    return effectiveFrom > to ? null : { from: effectiveFrom, to };
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

  private parseLimit(
    value: string | undefined,
    maxLimit = TelemetryService.HISTORY_LIMIT,
  ): number {
    if (!value) return maxLimit;

    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('El límite debe ser un entero positivo');
    }

    return Math.min(limit, maxLimit);
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
