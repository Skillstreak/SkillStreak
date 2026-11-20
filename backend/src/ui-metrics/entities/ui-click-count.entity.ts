import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The fixed vocabulary of countable screens and buttons (I-003,
 * docs/adr/0039-anonymous-ui-click-statistics.md Decision 4).
 *
 * **This enum is the authority.** The app holds a literal copy in
 * mobile/src/api/uiCounterKeys.ts, and ui-counter-key-parity.spec.ts fails
 * if the two differ in either direction.
 *
 * Form: `screen_<name>` / `btn_<name>`, snake_case. A key names a screen or
 * a button, never content — no clip, team, badge or player id, no free text,
 * no dynamic segment. The write endpoint is unauthenticated, so an open text
 * column would also be an unbounded write surface. Adding a key is a PR that
 * touches both lists and gets a security-reviewer pass; developers may trim
 * this list but not extend it without that review.
 */
export enum UiCounterKey {
  SCREEN_HOME = 'screen_home',
  SCREEN_SHORTS = 'screen_shorts',
  SCREEN_GOAL = 'screen_goal',
  SCREEN_TEAM = 'screen_team',
  SCREEN_CHAT = 'screen_chat',
  SCREEN_TIPS = 'screen_tips',
  SCREEN_PROFILE = 'screen_profile',
  BTN_LOG_TRAINING = 'btn_log_training',
  BTN_START_TIMER = 'btn_start_timer',
  BTN_STOP_TIMER = 'btn_stop_timer',
  BTN_RECORD_CLIP = 'btn_record_clip',
  BTN_SHARE_CLIP = 'btn_share_clip',
  BTN_OPEN_CLIP = 'btn_open_clip',
  BTN_CHAT_SEND = 'btn_chat_send',
  BTN_INVITE_FRIEND = 'btn_invite_friend',
}

/**
 * How many times a screen/button was used on a given day.
 *
 * **A counter, not an event log.** One row per (key, day). No created_at /
 * updated_at, no foreign keys, and no player, device, team, IP or user-agent
 * reference — none may be added without an ADR, because each would turn an
 * aggregate into something that can follow a child.
 */
@Entity('ui_click_count')
@Index('UQ_ui_click_count_key_day', ['key', 'day'], { unique: true })
export class UiClickCount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  key!: UiCounterKey;

  /** Date only (Europe/Stockholm). Deliberately no time. */
  @Column({ type: 'date' })
  day!: string;

  /** bigint (ADR-0039 Decision 6); node-postgres returns it as a string. */
  @Column({ type: 'bigint', default: 0 })
  count!: string;

  /** Number of upload calls (not people) that contributed; only used to
   * hide low-volume days in the admin view (ADR-0039 Decision 5). */
  @Column({ type: 'bigint', default: 1 })
  senders!: string;
}
