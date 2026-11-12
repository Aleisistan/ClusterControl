import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794465877313 implements MigrationInterface {
  name = 'InitialSchema1794465877313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const baselineTables = [
      'alert_configurations',
      'cameras',
      'clusters',
      'door_snapshots',
      'telemetry',
      'users',
    ];
    const existingTables = await queryRunner.getTables(baselineTables);

    if (existingTables.length === baselineTables.length) {
      return;
    }

    if (existingTables.length > 0) {
      throw new Error(
        'Cannot apply the initial schema migration to a partially initialized database.',
      );
    }

    await queryRunner.query(
      `CREATE TABLE "telemetry" ("id" SERIAL NOT NULL, "temperature1" double precision NOT NULL, "temperature2" double precision NOT NULL, "humidity1" double precision NOT NULL, "humidity2" double precision NOT NULL, "extractor" boolean NOT NULL, "aire" boolean NOT NULL, "puerta" boolean NOT NULL, "luzEncendida" boolean NOT NULL DEFAULT false, "source" character varying(32) NOT NULL DEFAULT 'device', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cluster_id" integer NOT NULL, CONSTRAINT "PK_9b2e5d3feb141269a262aa75fe8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_telemetry_cluster_created_at" ON "telemetry"  ("cluster_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cameras" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "ip" character varying NOT NULL, "status" boolean NOT NULL DEFAULT true, "snapshotUrl" character varying, "lastSeen" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "clusterId" integer, CONSTRAINT "UQ_f4ccf9e2171a1edcf08ddb2e47b" UNIQUE ("ip"), CONSTRAINT "PK_88b40b9817f9f422121f861e1e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "clusters" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "location" character varying, "lat" double precision, "lon" double precision, "deviceId" character varying, "timezone" character varying, CONSTRAINT "UQ_9866753a0c6ffd4adebb5cc236b" UNIQUE ("name"), CONSTRAINT "UQ_78ac45440c00a8986d3cbf0de75" UNIQUE ("deviceId"), CONSTRAINT "PK_56c8e201f375e1e961dcdd6831c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "alert_configurations" ("id" SERIAL NOT NULL, "temperatureLimit" double precision NOT NULL DEFAULT '30', "humidityLimit" double precision NOT NULL DEFAULT '80', "temperatureRecoveryLimit" double precision NOT NULL DEFAULT '27', "humidityRecoveryLimit" double precision NOT NULL DEFAULT '70', "temperatureEnabled" boolean NOT NULL DEFAULT true, "humidityEnabled" boolean NOT NULL DEFAULT true, "temperature1Active" boolean NOT NULL DEFAULT false, "temperature2Active" boolean NOT NULL DEFAULT false, "humidity1Active" boolean NOT NULL DEFAULT false, "humidity2Active" boolean NOT NULL DEFAULT false, "temperatureActive" boolean NOT NULL DEFAULT false, "humidityActive" boolean NOT NULL DEFAULT false, "recipients" text array NOT NULL DEFAULT '{}', "cluster_id" integer NOT NULL, CONSTRAINT "REL_be8855ac333b28113ca92e5e68" UNIQUE ("cluster_id"), CONSTRAINT "PK_87c580711f2b1caa0f82529d71c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "door_snapshots" ("id" SERIAL NOT NULL, "telemetryId" integer NOT NULL, "image" bytea NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cluster_id" integer NOT NULL, CONSTRAINT "UQ_93aedbaec4dbc4d9b67c5e9e52f" UNIQUE ("telemetryId"), CONSTRAINT "PK_b98154f8dc6baa2e7dca406624c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_door_snapshots_cluster_created_at" ON "door_snapshots"  ("cluster_id", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'ADMIN', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "telemetry" ADD CONSTRAINT "FK_f693dbe412f5853a296b7824a9b" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cameras" ADD CONSTRAINT "FK_301900c0f76addd5235b233f6da" FOREIGN KEY ("clusterId") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_configurations" ADD CONSTRAINT "FK_be8855ac333b28113ca92e5e68d" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "door_snapshots" ADD CONSTRAINT "FK_2603066e6d33f9f6e261a251602" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "door_snapshots" DROP CONSTRAINT "FK_2603066e6d33f9f6e261a251602"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_configurations" DROP CONSTRAINT "FK_be8855ac333b28113ca92e5e68d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cameras" DROP CONSTRAINT "FK_301900c0f76addd5235b233f6da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "telemetry" DROP CONSTRAINT "FK_f693dbe412f5853a296b7824a9b"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_door_snapshots_cluster_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "door_snapshots"`);
    await queryRunner.query(`DROP TABLE "alert_configurations"`);
    await queryRunner.query(`DROP TABLE "clusters"`);
    await queryRunner.query(`DROP TABLE "cameras"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_telemetry_cluster_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "telemetry"`);
  }
}
