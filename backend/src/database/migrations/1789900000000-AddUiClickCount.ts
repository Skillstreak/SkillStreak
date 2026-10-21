import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I-003 — anonymous UI click statistics.
 *
 * A counter keyed on (key, day), never an event log: no player, device,
 * team, IP, timestamp or any foreign key, so the table cannot answer "who".
 * `senders` is how many upload calls contributed to the row; the admin view
 * uses it to hide small cohorts (k-anonymity floor of 10).
 *
 * `day` defaults to the Europe/Stockholm calendar date rather than the
 * database session's `CURRENT_DATE`, so "per day" means the same day for the
 * operator whatever timezone the Postgres pod runs in.
 *
 * The unique index is load-bearing: the endpoint's UPSERT conflicts on it.
 */
export class AddUiClickCount1789900000000 implements MigrationInterface {
  name = 'AddUiClickCount1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ui_click_count" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(64) NOT NULL,
        "day" date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Stockholm')::date),
        "count" integer NOT NULL DEFAULT 0,
        "senders" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_ui_click_count" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ui_click_count_key_day" ON "ui_click_count" ("key", "day")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ui_click_count"`);
  }
}
