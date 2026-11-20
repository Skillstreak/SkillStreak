import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I-003 — anonymous UI click statistics
 * (docs/adr/0039-anonymous-ui-click-statistics.md).
 *
 * A counter keyed on (key, day), never an event log: no player, device,
 * team, IP, timestamp or any foreign key, so the table cannot answer "who".
 * `senders` is how many upload calls contributed to the row — calls, not
 * people — and the admin view uses it only to hide low-volume days
 * (Decision 5).
 *
 * `count` and `senders` are bigint (Decision 6): the write endpoint is
 * unauthenticated, and one client at the per-call cap could push an
 * `integer` past 2^31 within days, after which every upsert of that key
 * would fail for the rest of the day.
 *
 * `day` defaults to the Europe/Stockholm calendar date rather than the
 * database session's `CURRENT_DATE`, so "per day" means the same day for the
 * operator whatever timezone the Postgres pod runs in.
 *
 * The unique index is load-bearing: the endpoint's UPSERT conflicts on it.
 */
export class AddUiClickCount1790050000000 implements MigrationInterface {
  name = 'AddUiClickCount1790050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ui_click_count" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(64) NOT NULL,
        "day" date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Stockholm')::date),
        "count" bigint NOT NULL DEFAULT 0,
        "senders" bigint NOT NULL DEFAULT 1,
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
