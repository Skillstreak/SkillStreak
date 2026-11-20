/**
 * I-003 — the closed list of anonymous click-statistics keys
 * (docs/adr/0039-anonymous-ui-click-statistics.md Decision 4).
 *
 * A literal copy of the server's `UiCounterKey` enum
 * (backend/src/ui-metrics/entities/ui-click-count.entity.ts), which is the
 * authority. Kept in lockstep by a backend test
 * (backend/src/ui-metrics/ui-counter-key-parity.spec.ts) that reads THIS
 * file and fails on any difference in either direction — so keep it one
 * quoted string per entry inside this one array.
 *
 * A key names a screen or a button, never content: no clip, team, badge or
 * player in a key, and no dynamic segment. Adding one is a PR that touches
 * both lists and gets a security-reviewer pass (ADR-0039 Decision 4).
 */
export const UI_COUNTER_KEYS = [
  'screen_home',
  'screen_shorts',
  'screen_goal',
  'screen_team',
  'screen_chat',
  'screen_tips',
  'screen_profile',
  'btn_log_training',
  'btn_start_timer',
  'btn_stop_timer',
  'btn_record_clip',
  'btn_share_clip',
  'btn_open_clip',
  'btn_chat_send',
  'btn_invite_friend',
] as const;

export type UiCounterKey = (typeof UI_COUNTER_KEYS)[number];
