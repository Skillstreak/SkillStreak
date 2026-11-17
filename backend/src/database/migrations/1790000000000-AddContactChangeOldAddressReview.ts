import { MigrationInterface, QueryRunner } from 'typeorm';

// docs/adr/0012-profile-page-and-contact-email-change.md's 2026-11-08
// amendment. Closes a consent gap from the 2026-11-08 security audit: a
// player whose parental consent was still pending could redirect their
// parent contact to their own mailbox (confirmed from that same mailbox),
// wait out the 24h grace, then self-remind and approve their own consent.
//
// For non-approved accounts the OLD address now gets a link at request
// time that can approve the change (applies immediately) or stop it.
// Additive only, nullable, no backfill: a change already in flight when
// this deploys simply has no review code and finishes on the original
// flow — and the consent-reminder refusal (ConsentService) covers it
// regardless, because that check reads the pending state, not this column.
export class AddContactChangeOldAddressReview1790000000000 implements MigrationInterface {
  name = 'AddContactChangeOldAddressReview1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_private_info" ADD "contact_change_review_code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" ADD CONSTRAINT "UQ_player_private_info_contact_change_review_code" UNIQUE ("contact_change_review_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" ADD "contact_change_review_code_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" ADD "contact_change_approved_by_current_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_private_info" DROP COLUMN "contact_change_approved_by_current_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" DROP COLUMN "contact_change_review_code_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" DROP CONSTRAINT "UQ_player_private_info_contact_change_review_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" DROP COLUMN "contact_change_review_code"`,
    );
  }
}
