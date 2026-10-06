import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';

import { Telemetry } from '../telemetry.entity';

@Injectable()
export class TelemetryRepository {
  constructor(
    @InjectRepository(Telemetry)
    private repository: Repository<Telemetry>,
  ) {}

  create(data: Partial<Telemetry>) {
    return this.repository.create(data);
  }

  async save(telemetry: Telemetry) {
    return this.repository.save(telemetry);
  }

  async findLatest(clusterId: number): Promise<Telemetry | null> {
    return this.repository.findOne({
      where: { cluster: { id: clusterId } },
      relations: { cluster: true },
      order: { created_at: 'DESC' },
    });
  }

  async findHistory(
    clusterId: number,
    from: Date,
    to: Date,
    limit: number,
  ) {
    const sampledIds: Array<{ id: number }> = await this.repository.query(
      `
        WITH buckets AS (
          SELECT
            id,
            created_at,
            NTILE($4::int) OVER (ORDER BY created_at, id) AS bucket
          FROM telemetry
          WHERE cluster_id = $1
            AND created_at >= $2
            AND created_at <= $3
        )
        SELECT DISTINCT ON (bucket) id
        FROM buckets
        ORDER BY bucket, created_at, id
      `,
      [clusterId, from, to, limit],
    );

    if (sampledIds.length === 0) return [];

    return this.repository.find({
      where: { id: In(sampledIds.map(({ id }) => id)) },
      relations: { cluster: true },
      order: { created_at: 'ASC', id: 'ASC' },
    });
  }

  async findStateChanges(
    clusterId: number,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<
    Array<{
      id: number;
      createdAt: Date;
      temperature1: number;
      temperature2: number;
      humidity1: number;
      humidity2: number;
      extractor: boolean;
      aire: boolean;
      puerta: boolean;
      luzEncendida: boolean;
      previousExtractor: boolean;
      previousAire: boolean;
      previousPuerta: boolean;
      previousLuzEncendida: boolean;
    }>
  > {
    return this.repository.query(
      `
        WITH previous_sample AS (
          SELECT
            id, cluster_id, created_at, temperature1, temperature2,
            humidity1, humidity2, extractor, aire, puerta, "luzEncendida"
          FROM telemetry
          WHERE cluster_id = $1 AND created_at < $2
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ),
        samples AS (
          SELECT
            id, cluster_id, created_at, temperature1, temperature2,
            humidity1, humidity2, extractor, aire, puerta, "luzEncendida"
          FROM telemetry
          WHERE cluster_id = $1 AND created_at >= $2 AND created_at <= $3
          UNION ALL
          SELECT
            id, cluster_id, created_at, temperature1, temperature2,
            humidity1, humidity2, extractor, aire, puerta, "luzEncendida"
          FROM previous_sample
        ),
        compared AS (
          SELECT
            samples.*,
            LAG(extractor) OVER (ORDER BY created_at, id) AS previous_extractor,
            LAG(aire) OVER (ORDER BY created_at, id) AS previous_aire,
            LAG(puerta) OVER (ORDER BY created_at, id) AS previous_puerta,
            LAG("luzEncendida") OVER (ORDER BY created_at, id) AS previous_light
          FROM samples
        )
        SELECT
          id,
          created_at AS "createdAt",
          temperature1,
          temperature2,
          humidity1,
          humidity2,
          extractor,
          aire,
          puerta,
          "luzEncendida",
          previous_extractor AS "previousExtractor",
          previous_aire AS "previousAire",
          previous_puerta AS "previousPuerta",
          previous_light AS "previousLuzEncendida"
        FROM compared
        WHERE previous_extractor IS NOT NULL
          AND (
            extractor IS DISTINCT FROM previous_extractor
            OR aire IS DISTINCT FROM previous_aire
            OR puerta IS DISTINCT FROM previous_puerta
            OR "luzEncendida" IS DISTINCT FROM previous_light
          )
        ORDER BY created_at DESC, id DESC
        LIMIT $4
      `,
      [clusterId, from, to, limit],
    );
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repository.delete({
      created_at: LessThan(cutoff),
    });

    return result.affected ?? 0;
  }
}
