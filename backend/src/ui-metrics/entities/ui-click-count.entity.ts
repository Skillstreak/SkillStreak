import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The fixed vocabulary of countable screens and buttons (I-003).
 *
 * The write endpoint is unauthenticated, so an open text column would be an
 * unbounded write surface. Adding a key is a code change reviewed here.
 */
export enum UiCounterKey {
  SCREEN_HOME = 'screen_home',
  SCREEN_CHAT = 'screen_chat',
  SCREEN_SHORTS = 'screen_shorts',
  SCREEN_GOAL = 'screen_goal',
  SCREEN_TEAM = 'screen_team',
  SCREEN_TIPS = 'screen_tips',
  SCREEN_PROFILE = 'screen_profile',
  BTN_LOG_TRAINING = 'btn_log_training',
  BTN_START_TIMER = 'btn_start_timer',
  BTN_OPEN_CLIP = 'btn_open_clip',
  BTN_RECORD_CLIP = 'btn_record_clip',
  BTN_CHAT_SEND = 'btn_chat_send',
  BTN_INVITE_FRIEND = 'btn_invite_friend',
  BTN_OPEN_TIPS = 'btn_open_tips',
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

  @Column({ type: 'integer', default: 0 })
  count!: number;

  /** Number of upload calls that contributed; drives the <10 suppression. */
  @Column({ type: 'integer', default: 1 })
  senders!: number;
}
