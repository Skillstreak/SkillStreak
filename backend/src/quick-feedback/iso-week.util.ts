import { stockholmDateString } from '../common/time/stockholm-date.util';

/**
 * ISO 8601 week label ('YYYY-Www') of a 'YYYY-MM-DD' calendar date. Pure
 * calendar arithmetic: pass a value already resolved to Europe/Stockholm.
 */
export function isoWeekOfDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // The ISO week-year is the year of the week's Thursday.
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function currentStockholmIsoWeek(now: Date = new Date()): string {
  return isoWeekOfDate(stockholmDateString(now));
}

/**
 * Seconds from `now` until the next Monday 00:00 Europe/Stockholm, plus a
 * one-hour margin that absorbs a DST change inside the week. The margin is
 * harmless: the Redis key also carries the week label, so a key outliving
 * the week can never block the next one.
 */
export function secondsUntilStockholmWeekEnd(now: Date = new Date()): number {
  const today = stockholmDateString(now);
  const [year, month, day] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  const nextMonday = Date.UTC(year, month - 1, day + (8 - weekday));
  // Stockholm wall-clock "now", expressed as if it were UTC.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  const [h, m, s] = parts.split(':').map(Number);
  const wallNow = Date.UTC(year, month - 1, day, h % 24, m, s);
  return Math.ceil((nextMonday - wallNow) / 1000) + 3600;
}

/**
 * Absolute expiry (Unix seconds) for every weekly feedback claim made at
 * `now`: the end of the Stockholm week plus the margin, rounded to the hour.
 * Every claim in a week gets the same value, so a key's remaining TTL says
 * nothing about when that player answered. A per-claim relative TTL would:
 * matched against the answers' insertion order it links a child to their
 * answers. A DST change inside the week is the only split, one hour wide.
 */
export function stockholmWeekEndEpochSeconds(now: Date = new Date()): number {
  const end =
    Math.floor(now.getTime() / 1000) + secondsUntilStockholmWeekEnd(now);
  return Math.round(end / 3600) * 3600;
}
