import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * I-002 — anonymous quick feedback. The table has no player id, team id or
 * timestamp (only the ISO week), by design: nothing can be joined back to a
 * child. CHECK constraints keep it to the fixed question/choice vocabulary,
 * so free text cannot be stored even by a buggy writer.
 */
export class AddQuickFeedbackAnswer1789800000000 implements MigrationInterface {
  name = 'AddQuickFeedbackAnswer1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "quick_feedback_answer" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "question_id" character varying(32) NOT NULL,
        "choice" character varying(32) NOT NULL,
        "iso_week" character varying(8) NOT NULL,
        CONSTRAINT "PK_quick_feedback_answer" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_quick_feedback_answer_vocabulary" CHECK (
          ("question_id" = 'fun_today' AND "choice" IN ('happy', 'meh', 'sad'))
          OR ("question_id" = 'want_more'
              AND "choice" IN ('drills', 'challenges', 'badges', 'unsure'))
        ),
        CONSTRAINT "CHK_quick_feedback_answer_iso_week"
          CHECK ("iso_week" ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$')
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quick_feedback_answer_week_question"
       ON "quick_feedback_answer" ("iso_week", "question_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_quick_feedback_answer_week_question"`,
    );
    await queryRunner.query(`DROP TABLE "quick_feedback_answer"`);
  }
}
