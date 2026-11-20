import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-0035's 2026-11-20 amendment: staff can approve or reject a drill file
// marked `coachReviewed: false` from the console, instead of only by
// editing the file and redeploying (owner decision 2026-11-20).
//
// Properties the schema enforces:
//
//  1. **Still no drill row.** The drill's text stays a Markdown file in
//     git. This table holds a slug, a verdict, a content hash and who gave
//     the verdict — nothing a query could join to a player, team or clip.
//  2. **One current decision per drill** — the slug is the primary key, so
//     there is no ambiguity about which of several rows wins.
//  3. **A rejection carries a reason**, enforced by CHECK rather than only
//     by the DTO, so a direct write cannot produce a reasonless "no".
//  4. **The reviewer FK is SET NULL**, as on `trainer_post`: the record
//     that a review happened survives the reviewer's account.
export class AddDrillReview1790100000000 implements MigrationInterface {
  name = 'AddDrillReview1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "drill_review_status_enum" AS ENUM ('approved', 'rejected')
    `);

    await queryRunner.query(`
      CREATE TABLE "drill_review" (
        "drill_slug" character varying(120) NOT NULL,
        "status" "drill_review_status_enum" NOT NULL,
        -- The file the reviewer read. A changed file no longer matches and
        -- is treated as unreviewed again.
        "content_sha256" character(64) NOT NULL,
        "reviewed_by_staff_account_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "rejection_reason" character varying(300),
        CONSTRAINT "PK_drill_review" PRIMARY KEY ("drill_slug"),
        CONSTRAINT "FK_drill_review_reviewer" FOREIGN KEY ("reviewed_by_staff_account_id")
          REFERENCES "staff_account"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_drill_review_rejection_reason" CHECK (
          ("status" = 'rejected' AND length(btrim("rejection_reason")) >= 3)
          OR ("status" = 'approved' AND "rejection_reason" IS NULL)
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "drill_review"`);
    await queryRunner.query(`DROP TYPE "drill_review_status_enum"`);
  }
}
