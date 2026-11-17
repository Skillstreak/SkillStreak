import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I-007 Steg 1 — adds manual test flag (`is_test`) to Team.
 *
 * Allows marking test teams so they are excluded from public leaderboards
 * and usage metrics. Strictly no automated erasure or cron job in this step.
 */
export class AddTeamTestFlag1789950000000 implements MigrationInterface {
  name = 'AddTeamTestFlag1789950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team" ADD "is_test" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_team_is_test" ON "team" ("is_test") WHERE "is_test" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_team_is_test"`);
    await queryRunner.query(`ALTER TABLE "team" DROP COLUMN "is_test"`);
  }
}
