import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * I-002 — one anonymous quick-feedback answer.
 *
 * **The column list is the privacy guarantee.** No player id, no team id, no
 * timestamp finer than the ISO week: nothing here can be joined back to a
 * child, so there is deliberately no foreign key and nothing for account
 * erasure to delete. The once-a-week limit lives in Redis, keyed by player
 * id, and is never stored with these rows. No location field, no free text.
 */
@Entity('quick_feedback_answer')
@Index('IDX_quick_feedback_answer_week_question', ['isoWeek', 'questionId'])
export class QuickFeedbackAnswer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'question_id', type: 'varchar', length: 32 })
  questionId!: string;

  @Column({ type: 'varchar', length: 32 })
  choice!: string;

  /** 'YYYY-Www', Europe/Stockholm. */
  @Column({ name: 'iso_week', type: 'varchar', length: 8 })
  isoWeek!: string;
}
