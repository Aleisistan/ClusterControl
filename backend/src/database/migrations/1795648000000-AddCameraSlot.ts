import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCameraSlot1795648000000 implements MigrationInterface {
  name = 'AddCameraSlot1795648000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cameras" ADD COLUMN "slot" smallint`,
    );
    await queryRunner.query(`
      WITH ranked_cameras AS (
        SELECT
          "id",
          CASE
            WHEN COUNT(*) OVER (PARTITION BY "clusterId") = 1
              AND "name" = 'Cámara 2' THEN 2
            ELSE ROW_NUMBER() OVER (
              PARTITION BY "clusterId"
              ORDER BY CASE WHEN "name" = 'Cámara 2' THEN 1 ELSE 0 END, "id"
            )
          END::smallint AS "slot"
        FROM "cameras"
      )
      UPDATE "cameras" AS camera
      SET "slot" = ranked_cameras."slot"
      FROM ranked_cameras
      WHERE camera."id" = ranked_cameras."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "cameras" ALTER COLUMN "slot" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_camera_cluster_slot" ON "cameras" ("clusterId", "slot")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_camera_cluster_slot"`);
    await queryRunner.query(`ALTER TABLE "cameras" DROP COLUMN "slot"`);
  }
}
