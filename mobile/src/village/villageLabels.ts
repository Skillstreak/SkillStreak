import type { VillageLevel } from './villageTypes';

/**
 * Pure label helpers for the village (I-004). No React, no i18n import, no
 * state: they only turn server values into translation keys and neutral
 * fallbacks, so they are trivial to unit test (spec sections 9.1 and 9.2).
 */

export type VillageLevelKey = 'calm' | 'some' | 'many' | 'veryMany';

/** Product name. A brand name, so the same in every language and the fallback title. */
export const VILLAGE_NAME = 'Skillstreak Village';

const LEVEL_KEYS: Record<VillageLevel, VillageLevelKey> = {
  CALM: 'calm',
  SOME: 'some',
  MANY: 'many',
  VERY_MANY: 'veryMany',
};

/**
 * Server level -> the last part of `village.level.<key>`. An unknown, missing
 * or malformed level gives 'calm': the lowest and safest wording, never a
 * crash and never a raw enum value on screen.
 */
export function levelKey(level: string | null | undefined): VillageLevelKey {
  if (typeof level === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_KEYS, level)) {
    return LEVEL_KEYS[level as VillageLevel];
  }
  return 'calm';
}

/** Only lower-case letters, digits and underscore may reach a translation key. */
const SAFE_SPORT_KEY = /^[a-z0-9_]+$/;

/**
 * Lower-case sport key for `arenas.<key>.name`, or null when the value is not
 * safe to put in a key (a dot or colon would walk into other translations).
 */
export function arenaNameKey(sport: string | null | undefined): string | null {
  if (typeof sport !== 'string') return null;
  const key = sport.trim().toLowerCase();
  return SAFE_SPORT_KEY.test(key) ? key : null;
}

/**
 * Neutral name for a sport without its own translation: underscores become
 * spaces and the first letter is upper case (CURLING -> "Curling",
 * ICE_HOCKEY -> "Ice hockey"). Anything but letters and digits is dropped, so
 * odd server input cannot put markup, links or long text on screen. Returns
 * '' when nothing usable is left. Never returns the raw enum value.
 */
export function neutralSportName(sport: string | null | undefined): string {
  if (typeof sport !== 'string') return '';
  const words = sport
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 40)
    .trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
