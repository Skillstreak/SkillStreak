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

const DOTLESS_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * The consent flow stores the address as typed (only trimmed for the
 * format check), so this defines the comparison form. It is deliberately
 * aggressive at merging: one person must not pass for several parents by
 * writing the same inbox several ways (a false merge of two real parents
 * is negligibly likely).
 *
 * - Email: lower-cased whole; any "+tag" in the local part dropped (all
 *   domains — a "+tag" address delivers to the untagged inbox at every
 *   major provider); dots in the local part dropped for Gmail, whose
 *   googlemail.com alias is folded into gmail.com.
 * - Phone: only a leading "+" and digits kept; a leading "00" becomes "+".
 *   A national number ("070…") is NOT folded into "+4670…" — that needs
 *   the country, and the contact carries none.
 */
export function normaliseParentContact(raw: string): string {
  const trimmed = raw.normalize('NFC').trim();
  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    const at = lower.lastIndexOf('@');
    let local = lower.slice(0, at);
    let domain = lower.slice(at + 1);
    const plus = local.indexOf('+');
    if (plus > 0) local = local.slice(0, plus);
    if (domain === 'googlemail.com') domain = 'gmail.com';
    if (DOTLESS_DOMAINS.has(domain)) local = local.replace(/\./g, '');
    return `${local}@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
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
