import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE_URL, API_PREFIX } from './config';
import { secureDeleteItem, secureGetItem, secureSetItem } from './secureStorage';
import type { UiCounterKey } from './uiCounterKeys';

export type { UiCounterKey } from './uiCounterKeys';

/**
 * I-003 — anonymous click statistics, client half
 * (docs/adr/0039-anonymous-ui-click-statistics.md).
 *
 * Counts how often each screen is opened and each button is pressed, per
 * key, and uploads the totals. Nothing else (Decision 1): no timestamps, no
 * order of events, no player/team/device/session id, no auth header. The
 * request is a bare `fetch` on purpose and does NOT go through `client.ts`,
 * which attaches the session token.
 *
 * **Who may send (Decision 2).** Only self-verified accounts
 * (`isSelfVerification`, the Art. 8 age band and adults) consent for
 * themselves. An under-13 account is never eligible: the toggle is not
 * rendered for it, and this client refuses to turn on for it even if asked.
 *
 * **Default is off, strictly, and per account (Decision 3).** The flag is
 * stored under `skillstreak.anonymousStats.<accountId>`. Logout and an
 * account switch delete the leaving account's flag and discard any unsent
 * counts (never flushing them). On every start the client is off until
 * `initUiMetrics` has read the signed-in account's own flag. The account
 * id only names the local storage slot; it is never sent.
 *
 * The opt-in is enforced only here, in the app: the endpoint is anonymous
 * by design, so the server cannot tell who sent a batch, nor whether they
 * opted in.
 *
 * Counts are uploaded when the app goes to the background and otherwise on
 * a randomised 4–6 minute timer, so uploads are not aligned across users.
 * A failed upload is dropped rather than retried: these are statistics,
 * and a retry queue would be state worth less than the privacy of not
 * keeping it.
 */

const STORAGE_KEY_PREFIX = 'skillstreak.anonymousStats.';
// Server accepts count 1..1000 per key and at most 20 keys per call; the
// key list is shorter than 20, so one call always fits.
const MAX_COUNT_PER_KEY = 1000;
const MIN_INTERVAL_MS = 4 * 60 * 1000;
const MAX_INTERVAL_MS = 6 * 60 * 1000;

let enabled = false;
// The signed-in account the flag belongs to. Null before AppShell knows who
// is signed in and after logout; while null, nothing can be enabled.
let currentAccountId: string | null = null;
// Whether that account may consent for itself (ADR-0039 Decision 2).
let currentEligible = false;
let counts = new Map<UiCounterKey, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

function storageKey(accountId: string): string {
  return `${STORAGE_KEY_PREFIX}${accountId}`;
}

async function deleteStoredFlag(accountId: string): Promise<void> {
  try {
    await secureDeleteItem(storageKey(accountId));
  } catch {
    // Nothing to do: the in-memory client is already off.
  }
}

/** The signed-in account's saved choice; false when nobody eligible is
 * signed in. */
export async function loadAnonymousStatsEnabled(): Promise<boolean> {
  const accountId = currentAccountId;
  if (!accountId || !currentEligible) return false;
  try {
    return (await secureGetItem(storageKey(accountId))) === 'true';
  } catch {
    return false;
  }
}

/**
 * Called once the signed-in account is known (and again on every start),
 * so that account's own saved opt-in, and only that account's, applies.
 * A different account than the one loaded is an account switch: the
 * previous account's flag is deleted and its unsent counts discarded.
 */
export async function initUiMetrics(
  accountId: string,
  isSelfVerification: boolean,
): Promise<void> {
  const previous = currentAccountId;
  if (previous !== accountId) {
    applyEnabled(false);
    if (previous) await deleteStoredFlag(previous);
  }
  currentAccountId = accountId;
  currentEligible = isSelfVerification;
  if (!isSelfVerification) {
    // Under 13: never sends in v1. Clear any flag so nothing can turn it
    // back on from this device.
    applyEnabled(false);
    await deleteStoredFlag(accountId);
    return;
  }
  const saved = await loadAnonymousStatsEnabled();
  // Logout or an account switch may have happened while reading.
  if (currentAccountId === accountId && currentEligible) applyEnabled(saved);
}

/**
 * Logout: delete the leaving account's flag, switch the client off and
 * discard unsent counts (never flush them). The same account signing in
 * again starts from off.
 */
export async function resetUiMetrics(): Promise<void> {
  const accountId = currentAccountId;
  currentAccountId = null;
  currentEligible = false;
  applyEnabled(false);
  if (accountId) await deleteStoredFlag(accountId);
}

/** Returns the state actually applied — false when no eligible account is
 * signed in, so the switch can't show "on" while nothing is enabled. */
export async function setAnonymousStatsEnabled(next: boolean): Promise<boolean> {
  const accountId = currentAccountId;
  if (!accountId || !currentEligible) {
    applyEnabled(false);
    return false;
  }
  if (next) {
    await secureSetItem(storageKey(accountId), 'true');
  } else {
    await deleteStoredFlag(accountId);
  }
  if (currentAccountId !== accountId || !currentEligible) return false;
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

export function trackScreen(key: Extract<UiCounterKey, `screen_${string}`>): void {
  track(key);
}

export function trackButton(key: Extract<UiCounterKey, `btn_${string}`>): void {
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
      // No cookies either: nothing that could tie a batch to anyone.
      credentials: 'omit',
      body: JSON.stringify(body),
    });
  } catch {
    // Dropped on purpose — see the file header.
  }
}
