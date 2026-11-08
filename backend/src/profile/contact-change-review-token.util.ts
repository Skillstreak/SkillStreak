import { randomBytes } from 'crypto';

// docs/adr/0012's 2026-11-08 amendment — the OLD address's approve/stop
// link token. Same shape as consent-token.util.ts (32 random bytes, hex),
// not the 8-character human code the new address types into the app: this
// one is only ever clicked, never typed, and it gates the same decision a
// consent link does (whether a child's parent contact may move), so it
// gets the same entropy. Expiry is set by the caller — it tracks the
// lifetime of the change it governs rather than a fixed TTL.
const REVIEW_TOKEN_BYTES = 32;

export function generateContactChangeReviewToken(): string {
  return randomBytes(REVIEW_TOKEN_BYTES).toString('hex');
}
