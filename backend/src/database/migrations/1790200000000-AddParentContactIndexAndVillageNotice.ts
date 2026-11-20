import { MigrationInterface, QueryRunner } from 'typeorm';
import { parentContactIndex } from '../../common/crypto/parent-contact-index.util';
import {
  decryptPii,
  requirePiiEncryptionKeyFromEnv,
} from '../../common/crypto/pii-encryption.util';

/**
 * ADR-0040 (Village enable gate).
 *
 * - `player_private_info.parent_contact_index`: keyed blind index of the
 *   normalised parent contact, so "same parent?" can be answered in SQL
 *   (the 5-teams-per-parent cap, Village's distinct-parents rule). Backfilled
 *   here by decrypting each row in this process, the same way
 *   EncryptPlayerPrivateInfo1785200000000 did; nothing is logged. A row
 *   that fails to decrypt keeps a NULL index and is logged by count only.
 * - `team.village_join_notice_sent_at`: when the parents were last told the
 *   team joined Village, so re-joining within 30 days does not re-mail.
 */
export class AddParentContactIndexAndVillageNotice1790200000000 implements MigrationInterface {
  name = 'AddParentContactIndexAndVillageNotice1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_private_info" ADD "parent_contact_index" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_player_private_info_parent_contact_index" ON "player_private_info" ("parent_contact_index")`,
    );
    await queryRunner.query(
      `ALTER TABLE "team" ADD "village_join_notice_sent_at" timestamptz`,
    );

    const rows = (await queryRunner.query(
      `SELECT player_id, parent_contact FROM "player_private_info"`,
    )) as Array<{ player_id: string; parent_contact: string }>;
    if (rows.length === 0) return;
    const key = requirePiiEncryptionKeyFromEnv();
    let unreadable = 0;
    for (const row of rows) {
      let index: string;
      try {
        index = parentContactIndex(decryptPii(row.parent_contact, key), key);
      } catch {
        unreadable += 1;
        continue;
      }
      await queryRunner.query(
        `UPDATE "player_private_info" SET "parent_contact_index" = $1 WHERE "player_id" = $2`,
        [index, row.player_id],
      );
    }
    if (unreadable > 0) {
      console.warn(
        `AddParentContactIndexAndVillageNotice: ${unreadable} row(s) could not be decrypted and keep a NULL index.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team" DROP COLUMN "village_join_notice_sent_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_player_private_info_parent_contact_index"`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_private_info" DROP COLUMN "parent_contact_index"`,
    );
  }
}
