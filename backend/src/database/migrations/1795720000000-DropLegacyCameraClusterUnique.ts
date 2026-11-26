import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyCameraClusterUnique1795720000000
  implements MigrationInterface
{
  name = 'DropLegacyCameraClusterUnique1795720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cameras" DROP CONSTRAINT IF EXISTS "REL_301900c0f76addd5235b233f6d"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cameras" ADD CONSTRAINT "REL_301900c0f76addd5235b233f6d" UNIQUE ("clusterId")`,
    );
  }
}
