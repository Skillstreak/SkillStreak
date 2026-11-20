import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-0039 — Skillstreak Village (I-004).
 *
 * - `sport`: one sport per team; every existing team is a floorball team.
 * - `village_opt_in`: off by default. A team is invisible to every other
 *   team until its captain turns this on.
 * - `village_opt_in_changed_at` / `_by`: audit of the last change (the
 *   captain's player id).
 *
 * The partial index serves the only query that reads the flag: opted-in,
 * non-test teams, a small subset of `team`.
 */
export class AddTeamVillageFields1790100000000 implements MigrationInterface {
  name = 'AddTeamVillageFields1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team" ADD "sport" varchar(32) NOT NULL DEFAULT 'FLOORBALL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD CONSTRAINT "chk_team_sport" CHECK ("sport" IN ('FLOORBALL', 'FOOTBALL', 'ICE_HOCKEY'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD "village_opt_in" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD "village_opt_in_changed_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD "village_opt_in_changed_by" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_team_village_opt_in" ON "team" ("sport") WHERE "village_opt_in" = true AND "is_test" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_team_village_opt_in"`);
    await queryRunner.query(
      `ALTER TABLE "team" DROP COLUMN "village_opt_in_changed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" DROP COLUMN "village_opt_in_changed_at"`,
    );
    await queryRunner.query(`ALTER TABLE "team" DROP COLUMN "village_opt_in"`);
    await queryRunner.query(
      `ALTER TABLE "team" DROP CONSTRAINT "chk_team_sport"`,
    );
    await queryRunner.query(`ALTER TABLE "team" DROP COLUMN "sport"`);
  }
}
