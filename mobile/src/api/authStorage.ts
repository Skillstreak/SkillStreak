import { secureDeleteItem, secureGetItem, secureSetItem } from './secureStorage';
import { resetUiMetrics } from './uiMetricsClient';

// `sessionToken` is the JWT scoped to a single playerId, issued once at
// POST /players — there's no separate login step (per
// docs/api/phase1-contract.md), so this is the only credential the app
// ever persists. See secureStorage.ts for the SecureStore/localStorage
// platform split this relies on.
const SESSION_TOKEN_KEY = 'skillstreak.sessionToken';

// Local micro-challenge keys (see frontend architecture, L1).
const MICRO_KEYS = [
  'skillstreak.micro.doneToday',
  'skillstreak.micro.safetySeen',
  'skillstreak.micro.timerMarker',
] as const;

export async function getSessionToken(): Promise<string | null> {
  return secureGetItem(SESSION_TOKEN_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await secureSetItem(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  // I-003: every logout path ends here, so the click-statistics opt-in of
  // the account leaving can never keep counting for the next one.
  resetUiMetrics();
  await secureDeleteItem(SESSION_TOKEN_KEY);
  // L1: clear local micro-challenge state too, so it does not leak to the
  // next account on a shared device. Try every key independently; log only
  // the error code, never values.
  for (const key of MICRO_KEYS) {
    try {
      await secureDeleteItem(key);
    } catch {
      console.warn('MICRO_CLEAR_FAILED');
    }
  }
}
