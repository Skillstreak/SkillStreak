import { createHmac } from 'crypto';

/**
 * Blind index for `player_private_info.parent_contact` (ADR-0040).
 *
 * `parent_contact` is AES-256-GCM with a random IV (pii-encryption.util),
 * so two rows holding the same address have different ciphertexts and
 * cannot be compared in SQL. Two rules need exactly that comparison: the
 * "one parent contact, at most 5 teams" cap, and Village's "≥5 members
 * with distinct parent contacts". This index answers "same address?" and
 * nothing else: a keyed HMAC of the normalised value, so someone with a
 * database dump but not the key cannot test guesses against it.
 *
 * The HMAC key is derived from PII_ENCRYPTION_KEY with a fixed label
 * rather than being a second secret: anyone who has PII_ENCRYPTION_KEY can
 * already decrypt the column itself, so a separate key would add an
 * operational secret without adding protection. The label keeps the two
 * uses of the key domain-separated.
 *
 * Never log the input or the output.
 */

const INDEX_LABEL = 'skillstreak/parent-contact-index/v1';

/**
 * The consent flow stores the address as typed (only trimmed for the
 * format check), so this defines the comparison form: trimmed; an email
 * is lower-cased whole (real providers treat the local part
 * case-insensitively, and "Anna@X.se" vs "anna@x.se" must not count as
 * two parents); a phone number keeps only a leading "+" and its digits.
 */
export function normaliseParentContact(raw: string): string {
  const trimmed = raw.normalize('NFC').trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}

export function parentContactIndex(raw: string, rawPiiKey: string): string {
  const derivedKey = createHmac('sha256', Buffer.from(rawPiiKey, 'base64'))
    .update(INDEX_LABEL)
    .digest();
  return createHmac('sha256', derivedKey)
    .update(normaliseParentContact(raw))
    .digest('hex');
}

/** True for an email-shaped contact (the only kind that can be mailed). */
export function isEmailContact(raw: string): boolean {
  return raw.includes('@');
}
