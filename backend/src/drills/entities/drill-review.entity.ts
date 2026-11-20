import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum DrillReviewStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * A staff decision about one drill file whose front matter says
 * `coachReviewed: false` (ADR-0035's 2026-11-20 amendment).
 *
 * **The drill itself is still not a row.** Its content stays a Markdown
 * file in git, so ADR-0029 Decision 1's "nothing to join to a child" holds:
 * this table holds a slug, a verdict and who gave it — no player, no team,
 * no clip, and no drill text.
 *
 * One row per drill (the slug is the primary key): the row is the *current*
 * decision, and a later decision replaces it. That is the same shape as
 * `trainer_post`'s review columns, which also record only the latest
 * verdict.
 *
 * **Bound to the file's content, not just its name.** `contentSha256` is
 * the hash of the file as it was when the reviewer read it. If the file
 * changes afterwards, the approval no longer matches and the drill drops
 * back to "awaiting review" — an approval of one text must never publish
 * a different one.
 */
@Entity('drill_review')
export class DrillReview {
  /** The drill's file name without `.md` — the library's stable id. */
  @PrimaryColumn({ name: 'drill_slug', type: 'varchar', length: 120 })
  drillSlug!: string;

  @Column({
    type: 'enum',
    enum: DrillReviewStatus,
    enumName: 'drill_review_status_enum',
  })
  status!: DrillReviewStatus;

  /** SHA-256 (hex) of the drill file the reviewer actually read. */
  @Column({ name: 'content_sha256', type: 'char', length: 64 })
  contentSha256!: string;

  /**
   * Who let this drill into the library, or kept it out. SET NULL on
   * delete, like `trainer_post`: a reviewer leaving must not erase the
   * fact that a review happened (`reviewed_at` survives).
   */
  @Column({
    name: 'reviewed_by_staff_account_id',
    type: 'uuid',
    nullable: true,
  })
  reviewedByStaffAccountId!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz' })
  reviewedAt!: Date;

  /** Required when rejected (a CHECK constraint says so), null otherwise. */
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  rejectionReason!: string | null;
}
