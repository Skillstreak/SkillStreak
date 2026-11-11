import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE_URL, API_PREFIX } from './config';
import { secureDeleteItem, secureGetItem, secureSetItem } from './secureStorage';

/**
 * I-003 — anonymous click statistics, client half.
 *
 * Counts how often each screen is opened and each button is pressed, per
 * key, and uploads the totals. Nothing else: no timestamps, no order of
 * events, no player/team/device/session id, no auth header. The request is
 * a bare `fetch` on purpose and does NOT go through `client.ts`, which
 * attaches the session token.
 *
 * **Default is off, strictly.** While the flag is false nothing is
 * counted, nothing is held in memory and no request is made. The flag is
 * stored **per account** (keyed by player id) and switched off on logout,
 * so one person's opt-in never carries over to another child signing in on
 * the same phone. The choice itself (under 13, behind the ParentalGate) is
 * made in `AnonymousStatsCard`. The player id only names the local storage
 * slot; it is never sent.
 *
 * Counts are uploaded when the app goes to the background and otherwise on
 * a randomised 4–6 minute timer, so uploads are not aligned across users.
 * A failed upload is dropped rather than retried: these are statistics,
 * and a retry queue would be state worth less than the privacy of not
 * keeping it.
 */

export type UiCounterKey =
  | 'screen.home'
  | 'screen.shorts'
  | 'screen.goals'
  | 'screen.team'
  | 'screen.chat'
  | 'screen.tips'
  | 'screen.profile'
  | 'button.log_training'
  | 'button.start_timer'
  | 'button.stop_timer'
  | 'button.create_clip'
  | 'button.share_clip'
  | 'button.cheer';

const STORAGE_KEY_PREFIX = 'skillstreak.anonymousStatsEnabled.';
// Server accepts count 1..1000 per key and at most 20 keys per call.
const MAX_COUNT_PER_KEY = 1000;
const MIN_INTERVAL_MS = 4 * 60 * 1000;
const MAX_INTERVAL_MS = 6 * 60 * 1000;

let enabled = false;
// The signed-in account the flag belongs to. Null before AppShell knows who
// is signed in and after logout — and while null, nothing can be enabled.
let currentPlayerId: string | null = null;
let counts = new Map<UiCounterKey, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

function storageKey(playerId: string): string {
  return `${STORAGE_KEY_PREFIX}${playerId}`;
}

export async function loadAnonymousStatsEnabled(): Promise<boolean> {
  const playerId = currentPlayerId;
  if (!playerId) return false;
  try {
    return (await secureGetItem(storageKey(playerId))) === 'true';
  } catch {
    return false;
  }
}

/** Call once the signed-in player is known, so that account's saved
 * opt-in (and only that account's) takes effect. */
export async function initUiMetrics(playerId: string): Promise<void> {
  if (currentPlayerId !== playerId) applyEnabled(false);
  currentPlayerId = playerId;
  const saved = await loadAnonymousStatsEnabled();
  // Logout or an account switch may have happened while reading.
  if (currentPlayerId === playerId) applyEnabled(saved);
}

/** Logout: stop counting and forget whose flag was loaded. The stored
 * per-account flag stays, so the same account finds it as it left it. */
export function resetUiMetrics(): void {
  currentPlayerId = null;
  applyEnabled(false);
}

/** Returns the state actually applied — false when no account is known,
 * so the switch can't show "on" while nothing is enabled. */
export async function setAnonymousStatsEnabled(next: boolean): Promise<boolean> {
  const playerId = currentPlayerId;
  if (!playerId) {
    applyEnabled(false);
    return false;
  }
  if (next) {
    await secureSetItem(storageKey(playerId), 'true');
  } else {
    await secureDeleteItem(storageKey(playerId));
  }
  if (currentPlayerId !== playerId) return false;
  applyEnabled(next);
  return next;
}

function applyEnabled(next: boolean): void {
  enabled = next;
  if (!next) {
    // Turning off discards anything not yet sent — it is never uploaded.
    counts = new Map();
    stopSchedule();
    return;
  }
  startSchedule();
}

function startSchedule(): void {
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') void flush();
    });
  }
  scheduleNext();
}

function stopSchedule(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
}

function scheduleNext(): void {
  if (timer) clearTimeout(timer);
  const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  timer = setTimeout(() => {
    void flush();
    if (enabled) scheduleNext();
  }, delay);
}

function track(key: UiCounterKey): void {
  if (!enabled) return;
  counts.set(key, Math.min((counts.get(key) ?? 0) + 1, MAX_COUNT_PER_KEY));
}

export function trackScreen(key: Extract<UiCounterKey, `screen.${string}`>): void {
  track(key);
}

export function trackButton(key: Extract<UiCounterKey, `button.${string}`>): void {
  track(key);
}

async function flush(): Promise<void> {
  if (!enabled || counts.size === 0) return;
  const body = Array.from(counts, ([key, count]) => ({ key, count }));
  counts = new Map();
  try {
    await fetch(`${API_BASE_URL}${API_PREFIX}/ui-metrics/counts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Dropped on purpose — see the file header.
  }
}
